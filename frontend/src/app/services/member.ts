import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MemberService {

  private apiUrl = `${environment.apiUrl}/members`;

  constructor(private http: HttpClient) {}

  // Get JWT Authentication Headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // Get Members
  getMembers(
    search: string = '',
    status: string = '',
    page: number = 1,
    limit: number = 10,
    from?: string,
    to?: string
  ): Observable<any> {

    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (status) {
      params = params.set('status', status);
    }

    if (from && to) {
      params = params.set('from', from).set('to', to);
    }

    return this.http.get<any>(this.apiUrl, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  getAllMatchingMembers(
    search: string,
    status: string,
    from?: string,
    to?: string
  ): Observable<any[]> {
    const pageLimit = 100;

    return this.getMembers(search, status, 1, pageLimit, from, to).pipe(
      expand((response, index) => {
        const pagination = response.pagination;
        if (!pagination?.hasNextPage) return EMPTY;
        return this.getMembers(
          search,
          status,
          index + 2,
          pageLimit,
          from,
          to
        );
      }),
      reduce((members, response) => members.concat(response.members || []), [] as any[])
    );
  }

  // Add Member
  addMember(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data, {
      headers: this.getAuthHeaders()
    });
  }

  // Update Member
  updateMember(id: string, data: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/${id}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  // Delete Member
  deleteMember(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  generateMemberQR(memberId: string): Observable<any> {
  const token = localStorage.getItem('token');

  const headers = {
    Authorization: `Bearer ${token}`
  };

  return this.http.post(
    `${this.apiUrl}/${memberId}/generate-qr`,
    {},
    { headers }
  );
}

}