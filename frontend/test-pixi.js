import * as PIXI from 'pixi.js';
const g = new PIXI.Graphics();
g.rect(0,0,10,10).fill({color: 0xff0000, alpha: 0.5});
g.moveTo(0,0).lineTo(10,10).stroke({width: 1, color: 0xffffff, alpha: 0.5});
console.log("Pixi v8 graphics api success");
