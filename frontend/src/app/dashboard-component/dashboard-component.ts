import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../service/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-component',
  imports: [CommonModule],
  templateUrl: './dashboard-component.html',
  styleUrl: './dashboard-component.css',
})
export class DashboardComponent implements OnInit {
  models: any[] = [];
  selectedModel: any = null;
  selectedModelType: string | null = null;
  trainingRuns: any[] = [];
  evaluationResults: any[] = [];
  isLoading = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadModels();
  }

  loadModels() {
    this.api.getModels().subscribe((res: any) => {
      this.models = res || [];
    }, () => {
      this.models = [];
    });
  }

  selectModelType(type: string) {
    this.selectedModelType = type;
    this.isLoading = true;

    // find a model record in DB for this type (pick first)
    this.api.getModels().subscribe((res: any) => {
      const models: any[] = res || [];
      const model = models.find(m => (m.model_type || '').toLowerCase() === type.toLowerCase());
      if (model) {
        this.loadModelById(model.id);
      } else {
        this.selectedModel = null;
        this.trainingRuns = [];
        this.evaluationResults = [];
        this.isLoading = false;
      }
    }, () => { this.isLoading = false; });
  }

  loadModelById(id: number) {
    this.api.getModelById(id).subscribe((m: any) => {
      this.selectedModel = m;
      this.loadTrainingRunsForModel(m.id);
    }, () => {
      this.selectedModel = null;
      this.isLoading = false;
    });
  }

  loadTrainingRunsForModel(modelId: number) {
    this.api.getTrainingRuns(modelId).subscribe((runs: any) => {
      this.trainingRuns = runs || [];
      this.evaluationResults = [];
      // fetch evaluation results per run (backend supports filtering)
      const runIds = this.trainingRuns.map(r => r.id);
      if (runIds.length === 0) {
        this.isLoading = false;
        return;
      }

      // for each run, request its evaluation results
      let remaining = runIds.length;
      runIds.forEach((rid) => {
        this.api.getEvaluationResults(rid).subscribe((res: any) => {
          const items: any[] = res || [];
          this.evaluationResults.push(...items);
        }, () => {
          // ignore individual failures
        }, () => {
          remaining -= 1;
          if (remaining <= 0) {
            this.isLoading = false;
          }
        });
      });
    }, () => {
      this.trainingRuns = [];
      this.evaluationResults = [];
      this.isLoading = false;
    });
  }

  loadEvaluationResultsForRuns(runIds: number[]) {
    // legacy: keep for compatibility, but prefer per-run calls in loadTrainingRunsForModel
    this.api.getEvaluationResults().subscribe((results: any) => {
      const all: any[] = results || [];
      this.evaluationResults = all.filter(e => runIds.includes(e.training_run_id));
      this.isLoading = false;
    }, () => {
      this.evaluationResults = [];
      this.isLoading = false;
    });
  }

  getResultsForRun(runId: number) {
    return this.evaluationResults.filter(r => r.training_run_id === runId);
  }
}
