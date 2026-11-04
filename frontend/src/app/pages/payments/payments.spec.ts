import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Payments } from './payments';
import { PaymentService } from '../../services/payment';
import { MemberService } from '../../services/member';
import { MembershipPlanService } from '../../services/membership-plan';
import { DashboardService } from '../../services/dashboard';

describe('Payments', () => {
  let component: Payments;
  let fixture: ComponentFixture<Payments>;
  let memberService: { getAllMatchingMembers: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    memberService = {
      getAllMatchingMembers: vi.fn().mockReturnValue(of(
        Array.from({ length: 101 }, (_, index) => ({
          _id: `member-${index + 1}`,
          fullName: `Member ${index + 1}`,
          phone: `555${String(index + 1).padStart(4, '0')}`
        }))
      ))
    };

    await TestBed.configureTestingModule({
      imports: [Payments],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            getPayments: vi.fn().mockReturnValue(of({
              payments: [],
              summary: {
                totalTransactions: 0,
                totalCollection: 0,
                pendingTransactions: 0,
                totalOutstanding: 0
              },
              pagination: { currentPage: 1, totalPayments: 0, totalPages: 0 }
            }))
          }
        },
        { provide: MemberService, useValue: memberService },
        { provide: MembershipPlanService, useValue: { getMemberMemberships: vi.fn() } },
        { provide: DashboardService, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Payments);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates without dereferencing a missing membership GST snapshot', () => {
    component.openPaymentForm();
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.selectedMembership).toBeNull();
  });

  it('loads all active members through the paginated member service', () => {
    expect(memberService.getAllMatchingMembers).toHaveBeenCalledWith('', 'Active');
    expect(component.members).toHaveLength(101);
  });
});
