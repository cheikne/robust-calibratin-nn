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
  modelIds: Record<ModelKey, number> = { baseline: 3, robust: 7, detector: 4 };
  selectedModel: ModelKey = 'baseline';

  // UI selections for predict API
  selectedModelType: string = 'MLP'; // 'MLP' or 'CNN'
  selectedPerturbation: string = 'none'; // 'gaussian' | 'rotate' | 'blur' | 'none'
  perturbationLevel: number = 0.1;
  // stroke width for drawing (will be set proportional in ngAfterViewInit)
  strokeWidth: number = 4;
  predictionResult: any = null;

  constructor(private cdr: ChangeDetectorRef, private apiService: ApiService) {}

  ngAfterViewInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    // set line width proportional to canvas size so it scales well when
    // downsampling to 28x28. For a 280px canvas, factor 1 -> lineWidth ~4-10.
    const base = this.canvas.nativeElement.width / 28;
    this.strokeWidth = Math.max(1, Math.round(base * 1.0));
    this.ctx.lineWidth = this.strokeWidth;
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
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
  }

  onStrokeWidthChange(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    const w = Math.max(1, Math.round(Number(v)));
    this.strokeWidth = w;
    if (this.ctx) this.ctx.lineWidth = this.strokeWidth;
  }
  


  selectModelType(model: string) {
    this.selectedModelType = model;
  }

  selectPerturbation(noise: string) {
    this.selectedPerturbation = noise;
  }

  displayImage() {
    const data = this.centerAndPrepareImage();
    const imgEl = document.querySelector('img[alt="Drawn digit"]') as HTMLImageElement | null;
    // if (imgEl) imgEl.src = canvas.toDataURL('image/png');
    if (imgEl) imgEl.src = data;
  }

  predict() {
    // produce a 28x28 image for prediction
    // const data = this.centerAndPrepareImage(); 
    const modelId = this.selectedModelType === 'MLP' ? this.modelIds.baseline : this.modelIds.robust;
const canvas = this.canvas.nativeElement;
    this.apiService.predictDigit( canvas.toDataURL('image/png'), this.selectedPerturbation, this.selectedModelType, modelId, 0, this.perturbationLevel)
      .subscribe({
        next: (res) => {
          this.predictionResult = res;
          console.log('Prediction response', res);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Prediction error', err);
        }
      });
  }

  applyAttack() {
    const data = this.centerAndPrepareImage();
    const payload = {
      image: data.replace(/^data:image\/png;base64,/, ''),
      perturbation_type: this.selectedPerturbation,
      perturbation_level: this.perturbationLevel,
      model_type: this.selectedModelType
    };

    this.apiService.applyAttack(payload).subscribe({
      next: (res) => console.log('Attack applied', res),
      error: (err) => console.error('Attack error', err)
    });
  }

  onPerturbationLevelChange(event: Event) {
    const v = (event.target as HTMLInputElement).value;
    this.perturbationLevel = parseFloat(v);
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
  // Also create a 28x28 version to send to the backend to match MNIST size
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = 28;
  smallCanvas.height = 28;
  const sctx = smallCanvas.getContext('2d')!;
  // fill black background
  sctx.fillStyle = 'black';
  sctx.fillRect(0, 0, 28, 28);
  // draw the centered large canvas scaled down to 28x28
  sctx.drawImage(centeredCanvas, 0, 0, 28, 28);

  return smallCanvas.toDataURL('image/png');
}

}

