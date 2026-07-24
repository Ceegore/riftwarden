import { BUILD_MANIFEST } from './buildManifest';

export function App() {
  return (
    <main
      aria-hidden="true"
      data-build-channel={BUILD_MANIFEST.channel}
      data-testid="phase02-shell"
      className="rw-shell min-h-dvh"
    />
  );
}
