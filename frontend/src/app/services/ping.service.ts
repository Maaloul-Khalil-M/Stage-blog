import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PingResponse {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class PingService {
  constructor(private http: HttpClient) {}

  getStatus(): Observable<PingResponse> {
    return this.http.get<PingResponse>('/api/ping');
  }
}
