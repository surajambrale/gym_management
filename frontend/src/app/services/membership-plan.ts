import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MembershipPlanService {

  private apiUrl = `${environment.apiUrl}/membership-plans`;
  private memberMembershipsUrl = `${environment.apiUrl}/member-memberships`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  getPlans(): Observable<any> {
    return this.http.get<any>(this.apiUrl, {
      headers: this.getAuthHeaders()
    });
  }

  assignMembership(data: any): Observable<any> {
  return this.http.post<any>(
    `${this.memberMembershipsUrl}/assign`,
    data,
    { headers: this.getAuthHeaders() }
  );
}

  addPlan(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data, {
      headers: this.getAuthHeaders()
    });
  }

  updatePlan(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data, {
      headers: this.getAuthHeaders()
    });
  }

  deletePlan(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  getMemberMemberships(memberId: string): Observable<any> {
  return this.http.get<any>(
    `${this.memberMembershipsUrl}/member/${memberId}`,
    { headers: this.getAuthHeaders() }
  );
}
}