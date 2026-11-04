import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private apiUrl = `${environment.apiUrl}/dashboard`;
  private readonly refreshSubject = new Subject<void>();
  readonly refreshRequested$ = this.refreshSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/stats`,
      {
        params: { _cacheBust: Date.now() },
        headers: this.getAuthHeaders()
      }
    );
  }

  requestRefresh(): void {
    this.refreshSubject.next();
  }
}