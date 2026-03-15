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

  predictDigit(imageData: string, type_pre: string, modelSelected: string,modelId:number, image_id: number): Observable<any> {
    const base64 = imageData.replace(/^data:image\/png;base64,/, '');
    const body = { image: base64, type_pred: type_pre, model_type: modelSelected, modelId: modelId, image_id: image_id };

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
}