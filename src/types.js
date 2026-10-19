/** @typedef {{x:number,y:number,width:number,height:number}} Mask */
/** @typedef {{id:string,nvrId:string,channel:number,name:string,enabled:boolean,intervalMs:number,anchorMs:number,sensitivity:string,masks:Mask[],policyVersion:number}} Camera */
/** @typedef {{id:string,cameraId:string,capturedAt:number,bytes:number,checksum:string,relativePath:string,localPath:string|null,nasPath:string|null,state:'local'|'pending'|'transferred',availability:'available'|'unavailable'|'unknown'|'missing'}} Image */
// All persistent timestamps are UTC epoch milliseconds. Placement and availability are independent.
