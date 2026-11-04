import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { App } from './app';
import { AuthService } from './services/auth';
import { DashboardService } from './services/dashboard';
import { SessionActivityService } from './services/session-activity';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            getSessionReference: () => '',
            getProfile: () => of({
              success: true,
              owner: { name: 'Owner' },
              business: { businessName: 'Test Gym' },
              session: {
                id: 'session-1',
                lastActivityAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60_000).toISOString()
              }
            })
          }
        },
        {
          provide: DashboardService,
          useValue: {
            refreshRequested$: new Subject<void>(),
            getDashboardStats: () => of({ success: true, stats: {} })
          }
        },
        {
          provide: SessionActivityService,
          useValue: {
            warning$: new BehaviorSubject(false),
            remainingMs$: new BehaviorSubject(30 * 60 * 1000),
            sessionExpired$: new Subject(),
            start: vi.fn(),
            stop: vi.fn(),
            stayLoggedIn: vi.fn()
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show the dashboard after verifying the session', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Dashboard');
  });
});
