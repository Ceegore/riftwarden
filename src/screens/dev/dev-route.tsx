export async function loadComponentGallery(){
 if(import.meta.env['VITE_BUILD_CHANNEL']==='release'||import.meta.env['VITE_ENABLE_DEVTOOLS']!=='true') throw new Error('P07_GALLERY_IN_RELEASE');
 return import('./ComponentGalleryScreen');
}
