import { ChangeDetectorRef, Component } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { CommonModule } from '@angular/common';

// concrete model keys used across the component
type ModelKey = 'baseline' | 'robust' | 'detector';

@Component({
  selector: 'app-draw-component',
  imports: [],
  templateUrl: './draw-component.html',
  styleUrl: './draw-component.css',
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
  predictionResult: string = '';
  displayedImage: string | null = null;
  adversarialImage: string | null = null;
  predictionResultAttack: string = '';
  isAttackApplied: boolean = false;
  isPredicting: boolean = false;
  isApplyingAttack: boolean = false;
  isPredictAdv: boolean = false;
  modelId: number = this.modelIds['baseline'];
  isCorrectBtn: boolean = false;
  image_id: number = -1;
  adv_image_id: number = -1;
  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

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
    this.isAttackApplied = false;
    this.adversarialImage = null;
    this.predictionResult = '';
    this.predictionResultAttack = '';
    this.displayedImage = null; 
    this.isApplyingAttack = false;
    this.isPredictAdv = false;  
    this.isPredicting = false;
    this.image_id = -1;
    this.adv_image_id = -1;
    this.isCorrectBtn=false;

    // this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    this.ctx.fillStyle = 'black';
  this.ctx.fillRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);

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


  predict() {
    if (!['baseline', 'robust', 'detector'].includes(this.selectedModel)) {
      alert("OOps, You should select a model first.");
      return;
    
    }
    this.isPredicting = true;
    this.cdr.detectChanges();
    const centeredImage = this.centerAndPrepareImage();
    this.displayedImage = centeredImage;

    this.apiService.predictDigit(centeredImage, "NORMAL_PREDICTION",this.selectedModel, this.modelId, this.image_id).subscribe({
  
      next: (response) => {
        this.predictionResult = response.prediction;
        console.log(' Displayed Image:', this.predictionResult);  
        this.isPredicting = false;
          this.isCorrectBtn = true;
          this.image_id = response.imageId;
        this.cdr.detectChanges();
        console.log(' Prediction result:', response);
      },
      error: (err) => {
        console.error('Prediction error:', err);
      }
    });
  }


  display() {
      this.displayedImage = this.centerAndPrepareImage();
    // this.displayedImage = this.canvas.nativeElement.toDataURL('image/png');
  }


  applyAttack(method: string) {

    if (this.predictionResult === '') {
      alert('Please get a prediction before applying an attack.');
      return;
    }
    if (this.isCorrectBtn) {
      alert('Please, confirm if the predicted result is correct or no.');
      return;
    }
    if (method === "APPLY_ATTACK") {
    const canvas = this.canvas.nativeElement as HTMLCanvasElement;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.fillStyle = 'black';                   
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);               


    this.adversarialImage = this.displayedImage;
    }

    else if (method === "FGSM_ATTACK" || method === "PGD_ATTACK") {
      this.isApplyingAttack = true;
      this.cdr.detectChanges();
    if (this.image_id == -1) {
      alert("Something's wrong, Image Id is : "+this.image_id);
      return;
    }
      const data = {
        image: this.adversarialImage?.replace(/^data:image\/png;base64,/, ''),
        method_attack: method === "FGSM_ATTACK" ?  "fgsm" : "pgd",
        modelId: this.modelId,
        model_type: this.selectedModel,
        adv_image_id: this.adv_image_id == -1 ? null : this.adv_image_id,
        image_id: this.image_id == -1 ? null : this.image_id,
      };
  
      this.apiService.applyAttack(data).subscribe({
        next: (response) => {
          this.adversarialImage = response.adv_image;
          this.adv_image_id = response.adv_image_id;
          console.log(' Attack result:', response);
          this.isApplyingAttack = false;
          this.isAttackApplied = true;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(' Attack error:', err);
        }
      });
    }else if(method === "PREDICT") {
      if (!['baseline', 'robust', 'detector'].includes(this.selectedModel)) {
      alert("OOps, You should select a model first.");
      return;
      }
    
      this.isPredictAdv = true;
      this.cdr.detectChanges();
      const image = this.adversarialImage;
      if (image) {
      this.apiService.predictDigit(image, "ADV_PREDICTION", this.selectedModel,  this.modelId, this.adv_image_id).subscribe({
        next: (response) => {
          this.predictionResultAttack = response.prediction;
          this.isPredictAdv = false;
          this.cdr.detectChanges();
          console.log(' Prediction result:', response);
        },
        error: (err) => {
          console.error(' Prediction error:', err);
        }
      });
    }
    } else {
      alert('Unknown attack method.');
    }
  }
  selectModel(selectedModelId: keyof typeof this.modelIds) {
    if(selectedModelId == 'detector') {
      alert("Detector model not implemented yet.");
      return;
    }
    this.selectedModel = selectedModelId;
    this.modelId = this.modelIds[selectedModelId];
    this.cdr.detectChanges();
  }

  updateLabelImage(value: string) {
    if (this.image_id == -1) {
      alert("Something's wrong, press on clear button.")
    }

    if (value == "NO") {
      this.apiService.updateImageLabel(-1, this.image_id).subscribe({
        next: () => {
           this.isCorrectBtn = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(' Updating error:', err);
        }
      });
    }
    if (value == "YES") {
      this.isCorrectBtn = false;
      this.cdr.detectChanges();
    }
  }

 
}
