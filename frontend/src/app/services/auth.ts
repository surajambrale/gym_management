import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  // OWNER REGISTRATION
  register(data: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/register`,
      data
    ).pipe(
      tap(response => {
        if (response.success && response.token) {
          localStorage.setItem('token', response.token);
          localStorage.setItem(
            'owner',
            JSON.stringify(response.owner)
          );
          localStorage.setItem(
            'business',
            JSON.stringify(response.business)
          );
        }
      })
    );
  }

  // OWNER LOGIN
  login(data: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/login`,
      data
    ).pipe(
      tap(response => {
        if (response.success && response.token) {
          localStorage.setItem('token', response.token);
          localStorage.setItem(
            'owner',
            JSON.stringify(response.owner)
          );
          localStorage.setItem(
            'business',
            JSON.stringify(response.business)
          );
        }
      })
    );
  }

  // GET OWNER PROFILE
  // getProfile(): Observable<any> {
  //   const token = localStorage.getItem('token');

  //   return this.http.get<any>(
  //     `${this.apiUrl}/profile`,
  //     {
  //       headers: {
  //         Authorization: `Bearer ${token}`
  //       }
  //     }
  //   );
  // }

  getProfile(): Observable<any> {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Authentication token not found');
  }

  return this.http.get<any>(
    `${this.apiUrl}/profile`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}

  // CHECK LOGIN
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  // GET OWNER
  getOwner(): any {
    const owner = localStorage.getItem('owner');
    return owner ? JSON.parse(owner) : null;
  }

  // LOGOUT
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('owner');
    localStorage.removeItem('business');
  }
}