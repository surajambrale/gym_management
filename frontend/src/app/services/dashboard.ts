import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  getDashboardStats(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/stats`,
      { params: { _cacheBust: Date.now() } }
    );
  }

  requestRefresh(): void {
    this.refreshSubject.next();
  }
}