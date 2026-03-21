import { ChangeDetectorRef, Component } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

// concrete model keys used across the component
type ModelKey = 'baseline' | 'robust' | 'detector';

@Component({
  selector: 'app-draw-component',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './draw-component.html',
  styleUrls: ['./draw-component.css'],
})
export class DrawComponent {


  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;

  modelOptions: { label: string; value: ModelKey }[] = [
    { label: 'Baseline Model', value: 'baseline' },
    { label: 'Robust Model', value: 'robust' },
    { label: 'Detector Model', value: 'detector' }
  ];
  modelIds: Record<ModelKey, number> = { baseline: 3, robust: 7, detector: 4 };
  selectedModel: ModelKey = 'baseline';

  constructor( private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.ctx.lineWidth = 10;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = 'white';
    this.ctx.fillStyle = 'black';
  this.ctx.fillRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);

    
  }

  startDrawing(event: MouseEvent) {
    this.drawing = true;
    this.draw(event);
  }

  stopDrawing() {
    this.drawing = false;
    this.ctx.beginPath();
  }

  draw(event: MouseEvent) {
    if (!this.drawing) return;
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  clear() {

    // this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
  //   this.ctx.fillStyle = 'black';
  // this.ctx.fillRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);

  }

  centerAndPrepareImage(): string {
  const canvas = this.canvas.nativeElement;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  let xMin = canvas.width, xMax = 0, yMin = canvas.height, yMax = 0;
  const threshold = 200; 

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];


      if (a < 10) continue;


      const intensity = (r + g + b) / 3;

      // if (intensity < threshold) {
      //   if (x < xMin) xMin = x;
      //   if (x > xMax) xMax = x;
      //   if (y < yMin) yMin = y;
      //   if (y > yMax) yMax = y;
      // }
      const threshold = 200; 
      if (intensity > threshold) {  // instead of intensity < threshold
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }


  if (xMax <= xMin || yMax <= yMin) {
    return canvas.toDataURL('image/png');
  }

  const width = xMax - xMin;
  const height = yMax - yMin;

  const centeredCanvas = document.createElement('canvas');
  centeredCanvas.width = canvas.width;
  centeredCanvas.height = canvas.height;
  const cctx = centeredCanvas.getContext('2d')!;


  cctx.fillStyle = 'black';
  cctx.fillRect(0, 0, canvas.width, canvas.height);


  const scale = Math.min(
    (canvas.width * 0.8) / width,
    (canvas.height * 0.8) / height
  );

  const newWidth = width * scale;
  const newHeight = height * scale;
  const xOffset = (canvas.width - newWidth) / 2;
  const yOffset = (canvas.height - newHeight) / 2;

  cctx.drawImage(
    canvas,
    xMin, yMin, width, height,
    xOffset, yOffset, newWidth, newHeight
  );

  console.log(`Bounding box: (${xMin},${yMin}) - (${xMax},${yMax})`);
  return centeredCanvas.toDataURL('image/png');
}

}