#!/usr/bin/env python3
"""Extract ordered DOCX paragraphs/tables and conservative heading candidates.

Uses only the Python standard library. It does not declare a source authoritative and
never turns heuristic heading detection into a verified G00 result. Review the output.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
CP = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
DC = "http://purl.org/dc/elements/1.1/"
DCTERMS = "http://purl.org/dc/terms/"
EP = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
NS = {"w": W, "cp": CP, "dc": DC, "dcterms": DCTERMS, "ep": EP}


def qn(namespace: str, tag: str) -> str:
    return f"{{{namespace}}}{tag}"


def text_of(element: ET.Element) -> str:
    chunks: list[str] = []
    for node in element.iter():
        if node.tag == qn(W, "t") and node.text:
            chunks.append(node.text)
        elif node.tag == qn(W, "tab"):
            chunks.append("\t")
        elif node.tag in {qn(W, "br"), qn(W, "cr")}:
            chunks.append("\n")
    return "".join(chunks).strip()


def read_xml(archive: zipfile.ZipFile, name: str) -> ET.Element | None:
    try:
        return ET.fromstring(archive.read(name))
    except KeyError:
        return None


def style_map(styles_root: ET.Element | None) -> dict[str, dict[str, str | int | None]]:
    result: dict[str, dict[str, str | int | None]] = {}
    if styles_root is None:
        return result
    for style in styles_root.findall("w:style", NS):
        style_id = style.get(qn(W, "styleId"))
        if not style_id:
            continue
        name_node = style.find("w:name", NS)
        outline_node = style.find("w:pPr/w:outlineLvl", NS)
        result[style_id] = {
            "name": name_node.get(qn(W, "val")) if name_node is not None else style_id,
            "outlineLevel": int(outline_node.get(qn(W, "val"))) if outline_node is not None else None,
        }
    return result


def paragraph_properties(paragraph: ET.Element, styles: dict[str, dict]) -> dict:
    ppr = paragraph.find("w:pPr", NS)
    style_id = None
    outline = None
    num_id = None
    ilvl = None
    page_break_before = False
    if ppr is not None:
        pstyle = ppr.find("w:pStyle", NS)
        style_id = pstyle.get(qn(W, "val")) if pstyle is not None else None
        outline_node = ppr.find("w:outlineLvl", NS)
        if outline_node is not None:
            outline = int(outline_node.get(qn(W, "val")))
        numpr = ppr.find("w:numPr", NS)
        if numpr is not None:
            num_node = numpr.find("w:numId", NS)
            ilvl_node = numpr.find("w:ilvl", NS)
            num_id = num_node.get(qn(W, "val")) if num_node is not None else None
            ilvl = ilvl_node.get(qn(W, "val")) if ilvl_node is not None else None
        page_break_before = ppr.find("w:pageBreakBefore", NS) is not None
    style = styles.get(style_id, {})
    return {
        "styleId": style_id,
        "styleName": style.get("name"),
        "outlineLevel": outline if outline is not None else style.get("outlineLevel"),
        "numId": num_id,
        "numberingLevel": int(ilvl) if ilvl is not None else None,
        "pageBreakBefore": page_break_before,
    }


def heading_candidate(text: str, props: dict) -> dict | None:
    style_name = str(props.get("styleName") or "").lower()
    style_heading = any(token in style_name for token in ("heading", "überschrift", "chapter", "kapitel"))
    outline_heading = props.get("outlineLevel") is not None and int(props["outlineLevel"]) <= 1
    patterns = [
        re.compile(r"^\s*kapitel\s+(\d{1,2})\s*[:.\-–—]?\s*(.*)$", re.I),
        re.compile(r"^\s*(\d{1,2})\.\s+(.+)$"),
    ]
    matched = None
    for pattern in patterns:
        matched = pattern.match(text)
        if matched:
            break
    if not matched:
        return None
    chapter = int(matched.group(1))
    if not 1 <= chapter <= 87:
        return None
    title = matched.group(2).strip() or f"Kapitel {chapter}"
    confidence = "high" if style_heading or outline_heading else "candidate_only"
    return {
        "chapter": chapter,
        "title": title,
        "confidence": confidence,
        "reasons": {
            "styleHeading": style_heading,
            "outlineHeading": outline_heading,
            "numberPattern": True,
        },
    }


def metadata(archive: zipfile.ZipFile) -> dict:
    core = read_xml(archive, "docProps/core.xml")
    app = read_xml(archive, "docProps/app.xml")
    def value(root: ET.Element | None, path: str) -> str | None:
        node = root.find(path, NS) if root is not None else None
        return node.text if node is not None else None
    pages = value(app, "ep:Pages")
    return {
        "title": value(core, "dc:title"),
        "creator": value(core, "dc:creator"),
        "created": value(core, "dcterms:created"),
        "modified": value(core, "dcterms:modified"),
        "application": value(app, "ep:Application"),
        "applicationVersion": value(app, "ep:AppVersion"),
        "reportedPageCount": int(pages) if pages and pages.isdigit() else None,
    }


def extract(source: Path) -> dict:
    raw = source.read_bytes()
    with zipfile.ZipFile(source) as archive:
        document = read_xml(archive, "word/document.xml")
        if document is None:
            raise ValueError("word/document.xml is missing; file is not a readable DOCX")
        styles = style_map(read_xml(archive, "word/styles.xml"))
        body = document.find("w:body", NS)
        if body is None:
            raise ValueError("DOCX document body is missing")
        blocks: list[dict] = []
        candidates: list[dict] = []
        unsupported = {"drawings": 0, "textBoxes": 0, "altChunks": 0, "embeddedObjects": 0}
        for block_index, child in enumerate(list(body)):
            if child.tag == qn(W, "p"):
                text = text_of(child)
                props = paragraph_properties(child, styles)
                block = {"blockIndex": block_index, "type": "paragraph", "text": text, **props}
                blocks.append(block)
                candidate = heading_candidate(text, props)
                if candidate:
                    candidates.append({
                        **candidate,
                        "blockIndex": block_index,
                        "locator": f"block:{block_index}",
                        "styleId": props.get("styleId"),
                        "styleName": props.get("styleName"),
                    })
            elif child.tag == qn(W, "tbl"):
                rows = []
                for row in child.findall("w:tr", NS):
                    rows.append([text_of(cell) for cell in row.findall("w:tc", NS)])
                blocks.append({"blockIndex": block_index, "type": "table", "rows": rows})
            elif child.tag != qn(W, "sectPr"):
                blocks.append({"blockIndex": block_index, "type": "unsupported", "tag": child.tag})
        unsupported["drawings"] = len(document.findall(".//w:drawing", NS))
        unsupported["textBoxes"] = len(document.findall(".//w:txbxContent", NS))
        unsupported["altChunks"] = len(document.findall(".//w:altChunk", NS))
        unsupported["embeddedObjects"] = len(document.findall(".//w:object", NS))
        return {
            "schemaVersion": 1,
            "source": {
                "fileName": source.name,
                "byteSize": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "metadata": metadata(archive),
            },
            "blocks": blocks,
            "headingCandidates": candidates,
            "unsupportedCounts": unsupported,
            "reviewRequired": True,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = extract(args.source)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.out} with {len(result['blocks'])} blocks and {len(result['headingCandidates'])} heading candidates.")
    if any(result["unsupportedCounts"].values()):
        print("WARNING: unsupported/visual elements exist; rendered-page review is mandatory.")


if __name__ == "__main__":
    main()
