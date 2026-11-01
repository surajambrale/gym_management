import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {

  private apiUrl = 'http://localhost:5000/api/attendance';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // Mark Check-in
  checkIn(data: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/check-in`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  // Mark Check-out
  checkOut(memberId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/check-out`,
      { memberId },
      { headers: this.getAuthHeaders() }
    );
  }

  // Get Daily Attendance
  getDailyAttendance(date?: string): Observable<any> {
    let params = new HttpParams();

    if (date) {
      params = params.set('date', date);
    }

    return this.http.get(
      `${this.apiUrl}/daily`,
      {
        headers: this.getAuthHeaders(),
        params
      }
    );
  }

  // Get Member Attendance History
  getMemberAttendance(memberId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/member/${memberId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  checkInWithQR(qrToken: string): Observable<any> {
  const headers = this.getAuthHeaders();

  return this.http.post(
    `${this.apiUrl}/qr-check-in`,
    { qrToken },
    { headers }
  );
}
}