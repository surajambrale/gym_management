
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  BrowserMultiFormatReader,
  IScannerControls
} from '@zxing/browser';

import { AttendanceService } from '../../services/attendance';
import { MemberService } from '../../services/member';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.html',
  styleUrl: './attendance.scss'
})
export class Attendance implements OnInit, OnDestroy, OnChanges {

  @ViewChild('qrVideo')
  qrVideo!: ElementRef<HTMLVideoElement>;
  @Input() active = false;

  members: any[] = [];
  attendanceList: any[] = [];
  checkedInCount = 0;

  selectedMemberId = '';
  selectedDate = this.getTodayDate();

  loadingMembers = false;
  loadingAttendance = false;
  attendanceLoaded = false;
  private lastLoadedAt = 0;
  processing = false;

  successMessage = '';
  errorMessage = '';

  // QR Scanner properties
  qrScannerOpen = false;
  qrScanning = false;
  qrProcessing = false;

  private codeReader = new BrowserMultiFormatReader();
  private scannerControls?: IScannerControls;
  private scanLocked = false;

  constructor(
    private attendanceService: AttendanceService,
    private memberService: MemberService
  ) {}

  ngOnInit(): void {
    this.loadMembers();
    this.loadDailyAttendance();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['active'] &&
      !changes['active'].firstChange &&
      this.active &&
      (!this.lastLoadedAt || Date.now() - this.lastLoadedAt >= 60_000)
    ) {
      if (!this.loadingMembers) {
        this.loadMembers();
      }
      if (!this.loadingAttendance) {
        this.loadDailyAttendance();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopQRScanner();
  }

  // Get today's local date
  getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Load Members
  loadMembers(): void {
    this.loadingMembers = true;

    this.memberService.getMembers('', '', 1, 100).subscribe({
      next: (response: any) => {
        this.members = response.members || [];
        this.loadingMembers = false;
      },
      error: (error: any) => {
        console.error('Members loading error:', error);
        this.errorMessage = 'Unable to load members.';
        this.loadingMembers = false;
      }
    });
  }

  // Load Daily Attendance
  loadDailyAttendance(): void {
    this.loadingAttendance = true;
    this.attendanceLoaded = false;
    this.errorMessage = '';

    this.attendanceService
      .getDailyAttendance(this.selectedDate)
      .subscribe({
        next: (response: any) => {
          this.attendanceList = response.attendance || [];
          this.checkedInCount = this.attendanceList.filter(
            attendance => !attendance.checkOut
          ).length;
          this.attendanceLoaded = true;
          this.lastLoadedAt = Date.now();
          this.loadingAttendance = false;
        },
        error: (error: any) => {
          console.error('Attendance loading error:', error);
          this.errorMessage = 'Unable to load attendance.';
          this.loadingAttendance = false;
        }
      });
  }

  // Manual Check-in
  markCheckIn(): void {
    if (this.processing) {
      return;
    }

    if (!this.selectedMemberId) {
      this.errorMessage = 'Please select a member.';
      return;
    }

    this.processing = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.attendanceService.checkIn({
      memberId: this.selectedMemberId,
      attendanceType: 'Manual',
      notes: ''
    }).subscribe({
      next: (response: any) => {
        this.successMessage = response.message || 'Check-in successful.';
        this.selectedMemberId = '';
        this.processing = false;
        this.loadDailyAttendance();
      },
      error: (error: any) => {
        this.errorMessage =
          error.error?.message || 'Check-in failed.';
        this.processing = false;
      }
    });
  }

  // Manual Check-out
  markCheckOut(memberId: string): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.attendanceService.checkOut(memberId).subscribe({
      next: (response: any) => {
        this.successMessage = response.message || 'Check-out successful.';
        this.processing = false;
        this.loadDailyAttendance();
      },
      error: (error: any) => {
        this.errorMessage =
          error.error?.message || 'Check-out failed.';
        this.processing = false;
      }
    });
  }

  // Open QR Scanner
  openQRScanner(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.scanLocked = false;
    this.qrScannerOpen = true;
  }

  // Start camera scanner
  async startQRScanner(): Promise<void> {
    try {
      if (!this.qrVideo?.nativeElement) {
        this.errorMessage = 'Scanner camera is not ready. Please try again.';
        return;
      }

      this.errorMessage = '';
      this.qrScanning = true;

      this.scannerControls =
        await this.codeReader.decodeFromVideoDevice(
          undefined,
          this.qrVideo.nativeElement,
          (result) => {
            if (result && !this.scanLocked) {
              this.scanLocked = true;

              const qrToken = result.getText();

              this.stopQRScanner();
              this.submitQRAttendance(qrToken);
            }
          }
        );

    } catch (error) {
      console.error('QR Scanner Error:', error);
      this.qrScanning = false;
      this.errorMessage =
        'Unable to access camera. Please allow camera permission and try again.';
    }
  }

  // Send QR token to backend
  submitQRAttendance(qrToken: string): void {
    if (this.qrProcessing) {
      return;
    }

    this.qrProcessing = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.attendanceService.checkInWithQR(qrToken).subscribe({
      next: (response: any) => {
        this.successMessage =
          `${response.member?.fullName || 'Member'} - ${response.message}`;

        this.qrProcessing = false;
        this.qrScannerOpen = false;
        this.scanLocked = false;

        this.loadDailyAttendance();
      },
      error: (error: any) => {
        this.errorMessage =
          error.error?.message || 'QR attendance failed.';

        this.qrProcessing = false;
        this.scanLocked = false;
      }
    });
  }

  // Stop camera
  stopQRScanner(): void {
    if (this.scannerControls) {
      this.scannerControls.stop();
      this.scannerControls = undefined;
    }

    this.qrScanning = false;
  }

  // Close scanner
  closeQRScanner(): void {
    this.stopQRScanner();
    this.qrScannerOpen = false;
    this.scanLocked = false;
    this.qrProcessing = false;
  }

  // Change attendance date
  onDateChange(): void {
    this.loadDailyAttendance();
  }

}
