
import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, finalize, Subscription } from 'rxjs';

import { AuthService } from './services/auth';
import { DashboardService } from './services/dashboard';

import { Members } from './pages/members/members';
import { MembershipPlans } from './pages/membership-plans/membership-plans';
import { Attendance } from './pages/attendance/attendance';
import { Payments } from './pages/payments/payments';

import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    Members,
    MembershipPlans,
    Attendance,
    Payments
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {

  readonly appName = environment.appName;
  readonly appVersion = environment.appVersion;

  selectedMenu = 'Dashboard';
  mobileMenuOpen = false;

  isAuthenticated = false;
  sessionChecking = true;

  businessName = environment.appName;
  ownerName = 'Admin';

  stats: any[] = [];
  recentMembers: any[] = [];
  readonly dashboardStatPlaceholders = [0, 1, 2, 3];

  dashboardLoading = false;
  dashboardError = '';
  todayAttendance = 0;
  private dashboardLoadedAt = 0;
  private dashboardToken = '';
  private lastVerifiedToken = '';

  private sessionVerificationStarted = false;
  private routerSubscription?: Subscription;

  // SIDEBAR MENU GROUPS
  menuGroups = [
    {
      title: 'MAIN MENU',
      items: [
        { name: 'Dashboard', icon: '⌂' },
        { name: 'Members', icon: '♙' },
        { name: 'Membership Plans', icon: '▤' },
        { name: 'Attendance', icon: '◷' },
        { name: 'Payments & Fees', icon: '₹' }
      ]
    },
    {
      title: 'MANAGEMENT',
      items: [
        { name: 'Trainers & Staff', icon: '♟' },
        { name: 'Reports & Analytics', icon: '▥' },
        { name: 'Dance Academy', icon: '♫' }
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Settings', icon: '⚙' },
        { name: 'Subscription', icon: '◇' }
      ]
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    // Check session whenever route changes.
    this.routerSubscription = this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd)
      )
      .subscribe(() => {
        this.verifySession();
      });

    // Initial session check
    this.verifySession();
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  // SESSION VERIFICATION
  verifySession(): void {

    const currentUrl = this.router.url;

    // Login and registration pages
    if (
      currentUrl.startsWith('/login') ||
      currentUrl.startsWith('/register')
    ) {
      this.sessionChecking = false;
      this.isAuthenticated = false;
      this.lastVerifiedToken = '';
      return;
    }

    // Check token
    if (!this.authService.isLoggedIn()) {
      this.sessionChecking = false;
      this.isAuthenticated = false;

      if (currentUrl !== '/login') {
        this.router.navigate(['/login']);
      }

      return;
    }

    const token = localStorage.getItem('token') || '';
    if (this.isAuthenticated && token === this.lastVerifiedToken) {
      return;
    }

    // Avoid duplicate profile requests
    if (this.sessionVerificationStarted) {
      return;
    }

    this.sessionVerificationStarted = true;
    this.sessionChecking = true;

    this.authService.getProfile()
      .pipe(
        finalize(() => {
          this.sessionChecking = false;
          this.sessionVerificationStarted = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({

        next: (response) => {

          console.log('PROFILE RESPONSE:', response);

          if (
            response?.success === true &&
            response?.owner &&
            response?.business
          ) {

            this.isAuthenticated = true;
            this.lastVerifiedToken = token;

            if (this.dashboardToken && this.dashboardToken !== token) {
              this.stats = [];
              this.recentMembers = [];
              this.dashboardLoadedAt = 0;
            }

            this.ownerName = response.owner.name || 'Owner';

            this.businessName =
              response.business.businessName || this.appName;

            localStorage.setItem(
              'owner',
              JSON.stringify(response.owner)
            );

            localStorage.setItem(
              'business',
              JSON.stringify(response.business)
            );

            // Restore selected module
            if (currentUrl.startsWith('/members')) {
              this.selectedMenu = 'Members';
            } else {
              this.selectedMenu = 'Dashboard';
            }

            console.log('SESSION VERIFIED SUCCESSFULLY');

            this.loadDashboardData();

          } else {

            this.authService.logout();
            this.isAuthenticated = false;

            this.router.navigate(['/login']);
          }
        },

        error: (error) => {

          console.error('Session verification failed:', error);

          this.authService.logout();
          this.isAuthenticated = false;

          this.router.navigate(['/login']);
        }
      });
  }

  // AUTH ROUTE CHECK
  get isAuthRoute(): boolean {
    return (
      this.router.url.startsWith('/register') ||
      this.router.url.startsWith('/login')
    );
  }

  // LOGOUT
  logout(): void {

    this.authService.logout();

    this.isAuthenticated = false;
    this.sessionChecking = false;
    this.lastVerifiedToken = '';
    this.dashboardToken = '';
    this.dashboardLoadedAt = 0;
    this.stats = [];
    this.recentMembers = [];
    this.dashboardError = '';
    this.todayAttendance = 0;

    this.ownerName = 'Admin';
    this.businessName = this.appName;
    this.selectedMenu = 'Dashboard';

    this.mobileMenuOpen = false;

    this.router.navigate(['/login']);
  }

  // SIDEBAR MENU
  selectMenu(name: string): void {

    this.selectedMenu = name;
    this.mobileMenuOpen = false;

    if (name === 'Dashboard') {
      this.loadDashboardData();
    }
  }

  // MOBILE MENU
  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  // CURRENT DATE
  get currentDate(): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  }

  // DASHBOARD API
  loadDashboardData(force = false): void {

    if (this.dashboardLoading) {
      return;
    }

    if (
      !force &&
      this.stats.length > 0 &&
      Date.now() - this.dashboardLoadedAt < 60_000
    ) {
      return;
    }

    this.dashboardLoading = true;
    this.dashboardError = '';

    this.dashboardService.getDashboardStats()
      .pipe(
        finalize(() => {
          this.dashboardLoading = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({

        next: (response) => {

          console.log('DASHBOARD RESPONSE:', response);

          if (!response?.success || !response?.stats) {
            this.dashboardError = 'Unable to load dashboard data.';
            return;
          }

          const data = response.stats;
          this.dashboardLoadedAt = Date.now();
          this.dashboardToken = localStorage.getItem('token') || '';

          this.todayAttendance = data.todayAttendance ?? 0;

          this.stats = [
            {
              title: 'Total Members',
              value: (data.totalMembers ?? 0).toLocaleString('en-IN'),
              change: '',
              description: 'All registered members',
              icon: '♙',
              color: 'blue'
            },
            {
              title: 'Active Members',
              value: (data.activeMembers ?? 0).toLocaleString('en-IN'),
              change: '',
              description: 'Currently active',
              icon: '✓',
              color: 'green'
            },
            {
              title: 'Total Collected',
              value: '₹' + (data.totalCollected ?? 0).toLocaleString('en-IN'),
              change: '',
              description: 'Membership collection',
              icon: '₹',
              color: 'orange'
            },
            {
              title: 'Pending Fees',
              value: '₹' + (data.totalPending ?? 0).toLocaleString('en-IN'),
              change: '',
              description: 'Remaining membership fees',
              icon: '◷',
              color: 'red'
            }
          ];

          this.recentMembers = (response.recentMembers || []).map(
            (member: any) => ({
              id: member._id?.slice(-6).toUpperCase() || '-',
              name: member.fullName || 'Member',
              phone: member.phone || '-',
              plan: '-',
              joining: new Date(
                member.joiningDate || member.createdAt
              ).toLocaleDateString('en-IN'),
              status: member.status || 'Active'
            })
          );
        },

        error: (error) => {

          console.error('Dashboard API Error:', error);

          this.dashboardError =
            'Unable to load dashboard data. Please try again.';
        }
      });
  }
}
