import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://0.0.0.0:8000/api';

  constructor(private http: HttpClient) {}

  predict(model: string, imageData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/predict`, { model, imageData });
  }

  getMetrics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/metrics`);
  }

  predictDigit(imageData: string, perturbation_type: string, modelSelected: string, modelId: number, image_id: number, perturbation_level: number = 0.0): Observable<any> {
    const base64 = imageData.replace(/^data:image\/png;base64,/, '');
    const body = {
      image: base64,
      perturbation_type: perturbation_type,
      perturbation_level: perturbation_level,
      model_type: modelSelected,
      modelId: modelId,
      image_id: image_id
    };

    return this.http.post(`${this.baseUrl}/predict`, body);
  }

    applyAttack(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/attack`, data);
  }

  updateImageLabel(label: number, image_id: number) : Observable<any> {
      return this.http.post(`${this.baseUrl}/images/update`, {true_label: label, image_id: image_id});
  }

    getImages(): Observable<any> {
      return this.http.get(`${this.baseUrl}/images/`);
  }

  getAdvImages(): Observable<any> {
      return this.http.get(`${this.baseUrl}/images/adv-images`);
  }

    // Models / training runs / evaluation results
    getModels(): Observable<any> {
      return this.http.get(`${this.baseUrl}/models`);
    }

    getModelById(id: number): Observable<any> {
      return this.http.get(`${this.baseUrl}/models/${id}`);
    }

    getTrainingRuns(modelId?: number): Observable<any> {
      if (typeof modelId === 'number') {
        return this.http.get(`${this.baseUrl}/training-runs?model_id=${modelId}`);
      }
      return this.http.get(`${this.baseUrl}/training-runs`);
    }

    getEvaluationResults(trainingRunId?: number): Observable<any> {
      if (typeof trainingRunId === 'number') {
        return this.http.get(`${this.baseUrl}/evaluation-results?training_run_id=${trainingRunId}`);
      }
      return this.http.get(`${this.baseUrl}/evaluation-results`);
    }
}