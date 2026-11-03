import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ManagementService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getStaff(): Observable<any> {
    return this.http.get(`${this.baseUrl}/trainers-staff`, {
      headers: this.headers
    });
  }

  createStaff(data: object): Observable<any> {
    return this.http.post(`${this.baseUrl}/trainers-staff`, data, {
      headers: this.headers
    });
  }

  updateStaff(id: string, data: object): Observable<any> {
    return this.http.put(`${this.baseUrl}/trainers-staff/${id}`, data, {
      headers: this.headers
    });
  }

  deleteStaff(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/trainers-staff/${id}`, {
      headers: this.headers
    });
  }

  getReport(from: string, to: string): Observable<any> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get(`${this.baseUrl}/reports`, {
      headers: this.headers,
      params
    });
  }

  getSettings(): Observable<any> {
    return this.http.get(`${this.baseUrl}/business/settings`, {
      headers: this.headers
    });
  }

  updateSettings(data: object): Observable<any> {
    return this.http.put(`${this.baseUrl}/business/settings`, data, {
      headers: this.headers
    });
  }

  getSubscription(): Observable<any> {
    return this.http.get(`${this.baseUrl}/business/subscription`, {
      headers: this.headers
    });
  }
}
