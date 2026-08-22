/**
 * LeaveRequestStepperComponent
 * ------------------------------------------------------------------
 * A single self-contained Angular component that:
 *   1. Models the data as a plain signal (Signal Forms): a read-only
 *      `profile` object (as if fetched from HR) plus the editable
 *      fields the employee actually fills in for this request.
 *   2. Walks the user through it via an Angular Material `<mat-stepper>`,
 *      restyled with the `stepper-overrides` token mixin instead of
 *      `::ng-deep`.
 *   3. Re-implements the FR / TN business-logic spec (PAID_ANNUAL, SICK,
 *      UNPAID, MATERNITY) as pure `computed()` derivations of the form.
 *   4. Logs the final decision to the console on submit.
 *
 * Prerequisites (not included here):
 *   - Angular with `@angular/forms/signals` available (Signal Forms).
 *   - `@angular/material` installed and themed at the app root
 *     (`@include mat.core();` + a theme mixin) — the token overrides in
 *     the companion .scss file customize that base theme, they don't
 *     replace it.
 *   - Tailwind CSS configured for the project, with this component's
 *     file included in `content`.
 *   - Animations provider registered app-wide, e.g. in `app.config.ts`:
 *       providers: [provideAnimationsAsync()]
 *     `mat-stepper` will not animate/step correctly without this.
 *   - For the type treatment: link "Fraunces", "IBM Plex Sans" and
 *     "IBM Plex Mono" (Google Fonts) in index.html. Each has a plain
 *     system-font fallback, so the UI still works without them.
 *
 * Note: Signal Forms is a newer, still-evolving API. `[formField]` is
 * used here against native inputs (profile) and Material controls
 * (mat-select, mat-checkbox, matInput) — the latter relies on those
 * components' ControlValueAccessor implementation, the same contract
 * reactive forms uses.
 */

import {ChangeDetectionStrategy, Component, computed, signal} from '@angular/core';
import {form, FormField, min, readonly, required} from '@angular/forms/signals';
import {MatStepperModule} from '@angular/material/stepper';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatButtonModule} from '@angular/material/button';

// ---------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------

//type Country = 'FR' | 'TN';
type Country = string;
type LeaveType = 'PAID_ANNUAL' | 'SICK' | 'UNPAID' | 'MATERNITY';

/** Read-only — comes from the HR system, not something the employee edits here. */
interface EmployeeProfile {
  name: string;
  employeeId: string;
  country: Country;
  seniority: number;
  age: number;
  monthsAccrued: number;
  carryover: number;
  taken: number;
}

/** Editable — only what the employee is requesting right now. */
interface LeaveRequestData {
  profile: EmployeeProfile;
  leaveType: LeaveType;
  requested: number; // PAID_ANNUAL
  block: number; // PAID_ANNUAL, TN only
  hasCert: boolean; // SICK / MATERNITY
  sickDays: number; // SICK
  occupational: boolean; // SICK, FR only
  unpaidRequested: number; // UNPAID
}

interface LedgerEntry {
  label: string;
  amount: number;
}

interface DecisionResult {
  leaveType: LeaveType;
  country: Country;
  /** true = approved, false = rejected, null = pending manager discretion */
  approved: boolean | null;
  reasons: string[];
  ledger: LedgerEntry[];
  totalBalanceAfter?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

@Component({
             selector: 'app-leave-request-stepper',
             standalone: true,
             changeDetection: ChangeDetectionStrategy.OnPush,
             imports: [
               FormField,
               MatStepperModule,
               MatFormFieldModule,
               MatInputModule,
               MatSelectModule,
               MatCheckboxModule,
               MatButtonModule,
             ],
             styleUrl: './leave-request-stepper.component.scss',
             template: `
               <div class="mx-auto max-w-2xl">
                 <div
                   class="rounded-2xl border border-slate-200 bg-[#F5F4F0] p-6 shadow-sm sm:p-8">
                   <header
                     class="mb-6 flex items-end justify-between border-b border-slate-300 pb-4">
                     <div>
                       <p
                         class="font-data text-[11px] uppercase tracking-[0.2em] text-slate-500">{{ referenceId }}</p>
                       <h2 class="font-display text-2xl leading-none text-[#14171F]">Leave
                         request</h2>
                     </div>
                     <p class="font-data text-xs text-slate-400">{{ today }}</p>
                   </header>

                   <mat-stepper orientation="horizontal" [linear]="true" #stepper
                                class="!bg-transparent">
                     <!-- STEP 1: read-only HR profile + what the employee wants -->
                     <mat-step [completed]="step1Complete()" label="Employee profile">
                       <div class="space-y-6 py-5">
                         <div class="rounded-lg border border-slate-200 bg-white/70 p-5">
                           <div class="mb-4 flex items-baseline justify-between">
                             <h3 class="font-display text-base text-[#14171F]">Personnel
                               record</h3>
                             <span class="font-data text-xs tracking-wide text-slate-500">
                    {{ leaveModel().profile.employeeId }}
                  </span>
                           </div>

                           <div class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                             <label class="profile-field">
                               <span class="profile-label">Name</span>
                               <input [formField]="leaveForm.profile.name"
                                      class="profile-value"/>
                             </label>
                             <label class="profile-field">
                               <span class="profile-label">Jurisdiction</span>
                               <input [formField]="leaveForm.profile.country"
                                      class="profile-value"/>
                             </label>
                             <label class="profile-field">
                               <span class="profile-label">Seniority (yrs)</span>
                               <input type="number"
                                      [formField]="leaveForm.profile.seniority"
                                      class="profile-value"/>
                             </label>
                             <label class="profile-field">
                               <span class="profile-label">Age</span>
                               <input type="number" [formField]="leaveForm.profile.age"
                                      class="profile-value"/>
                             </label>
                             <label class="profile-field">
                               <span class="profile-label">Accrued this year (mo.)</span>
                               <input type="number"
                                      [formField]="leaveForm.profile.monthsAccrued"
                                      class="profile-value"/>
                             </label>
                             <label class="profile-field">
                               <span class="profile-label">Carryover (days)</span>
                               <input type="number"
                                      [formField]="leaveForm.profile.carryover"
                                      class="profile-value"/>
                             </label>
                             <label class="profile-field">
                               <span class="profile-label">Already taken (days)</span>
                               <input type="number" [formField]="leaveForm.profile.taken"
                                      class="profile-value"/>
                             </label>
                           </div>

                           <p class="mt-4 text-xs text-slate-500">
                             Pulled from HR records — not editable here. Contact HR to
                             correct any of these figures.
                           </p>
                         </div>

                         <mat-form-field appearance="outline" class="w-full max-w-xs">
                           <mat-label>What are you requesting?</mat-label>
                           <mat-select [formField]="leaveForm.leaveType">
                             <mat-option value="PAID_ANNUAL">Paid annual leave
                             </mat-option>
                             <mat-option value="SICK">Sick leave</mat-option>
                             <mat-option value="UNPAID">Unpaid leave</mat-option>
                             <mat-option value="MATERNITY">Maternity leave</mat-option>
                           </mat-select>
                         </mat-form-field>

                         <div class="flex gap-3 border-t border-slate-200 pt-4">
                           <button mat-flat-button color="primary" matStepperNext
                                   type="button" [disabled]="!step1Complete()">
                             Next
                           </button>
                         </div>
                       </div>
                     </mat-step>

                     <!-- STEP 2: only the fields the employee actually needs to submit -->
                     <mat-step [completed]="step2Complete()" label="Request details">
                       <div class="space-y-4 py-5">
                         @if (leaveForm.leaveType().value() === 'PAID_ANNUAL') {
                           <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                             <mat-form-field appearance="outline" class="w-full">
                               <mat-label>Days requested now</mat-label>
                               <input matInput type="number"
                                      [formField]="leaveForm.requested"/>
                             </mat-form-field>
                             @if (leaveModel().profile.country === 'TN') {
                               <mat-form-field appearance="outline" class="w-full">
                                 <mat-label>Length of consecutive block</mat-label>
                                 <input matInput type="number"
                                        [formField]="leaveForm.block"/>
                               </mat-form-field>
                             }
                           </div>
                         }

                         @if (leaveForm.leaveType().value() === 'SICK') {
                           <mat-checkbox [formField]="leaveForm.hasCert" class="block">
                             Valid medical certificate provided
                           </mat-checkbox>

                           <mat-form-field appearance="outline" class="w-full max-w-xs">
                             <mat-label>Days of certified absence</mat-label>
                             <input matInput type="number"
                                    [formField]="leaveForm.sickDays"/>
                           </mat-form-field>

                           @if (leaveModel().profile.country === 'FR') {
                             <mat-checkbox [formField]="leaveForm.occupational"
                                           class="block">
                               Occupational (workplace) illness
                             </mat-checkbox>
                           }
                         }

                         @if (leaveForm.leaveType().value() === 'UNPAID') {
                           <mat-form-field appearance="outline" class="w-full max-w-xs">
                             <mat-label>Total unpaid days requested this year</mat-label>
                             <input matInput type="number"
                                    [formField]="leaveForm.unpaidRequested"/>
                           </mat-form-field>
                         }

                         @if (leaveForm.leaveType().value() === 'MATERNITY') {
                           <mat-checkbox [formField]="leaveForm.hasCert" class="block">
                             Medical certificate presented
                           </mat-checkbox>
                         }

                         <div class="flex gap-3 border-t border-slate-200 pt-4">
                           <button mat-stroked-button matStepperPrevious type="button">
                             Back
                           </button>
                           <button mat-flat-button color="primary" matStepperNext
                                   type="button" [disabled]="!step2Complete()">
                             Next
                           </button>
                         </div>
                       </div>
                     </mat-step>

                     <!-- STEP 3: Review & Submit -->
                     <mat-step label="Review & submit">
                       <div class="space-y-5 py-5">
                         <div class="flex items-center justify-between">
                           <h3 class="font-display text-lg text-[#14171F]">
                             {{ leaveTypeLabels[decision().leaveType] }}
                             — {{ decision().country }}
                           </h3>
                           <span
                             class="stamp"
                             [class.approved]="decision().approved === true"
                             [class.rejected]="decision().approved === false"
                             [class.pending]="decision().approved === null"
                           >
                  {{ decision().approved === true ? 'Approved' : decision().approved === false ? 'Rejected' : 'Pending' }}
                </span>
                         </div>

                         <ul
                           class="list-inside list-disc space-y-1 text-sm text-slate-600">
                           @for (r of decision().reasons; track $index) {
                             <li>{{ r }}</li>
                           }
                         </ul>

                         @if (decision().ledger.length) {
                           <table class="ledger font-data w-full text-sm">
                             <tbody>
                               @for (entry of decision().ledger; track $index) {
                                 <tr class="border-b border-slate-200">
                                   <td class="py-1.5 text-slate-600">{{ entry.label }}
                                   </td>
                                   <td class="py-1.5 text-right tabular-nums"
                                       [class.negative]="entry.amount < 0">
                                     {{ entry.amount }}
                                   </td>
                                 </tr>
                               }
                               @if (decision().totalBalanceAfter !== undefined) {
                                 <tr class="total">
                                   <td class="py-1.5">Balance after this request</td>
                                   <td
                                     class="py-1.5 text-right tabular-nums">{{ decision().totalBalanceAfter }}
                                   </td>
                                 </tr>
                               }
                             </tbody>
                           </table>
                         }

                         <div class="flex gap-3 border-t border-slate-200 pt-4">
                           <button mat-stroked-button matStepperPrevious type="button">
                             Back
                           </button>
                           <button mat-flat-button color="primary" type="button"
                                   (click)="onSubmit()">Submit
                           </button>
                         </div>
                       </div>
                     </mat-step>
                   </mat-stepper>
                 </div>
               </div>
             `,
           })
export class LeaveRequestStepperComponent {
  readonly referenceId = 'REQ-' + Math.floor(100000 + Math.random() * 900000);
  readonly today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  readonly leaveTypeLabels: Record<LeaveType, string> = {
    PAID_ANNUAL: 'Paid annual leave',
    SICK: 'Sick leave',
    UNPAID: 'Unpaid leave',
    MATERNITY: 'Maternity leave',
  };

  // -------------------------------------------------------------------
  // 1. The model: a plain signal holding the raw data. `profile` stands
  //    in for whatever your HR/employee-record service would return.
  // -------------------------------------------------------------------
  leaveModel = signal<LeaveRequestData>({
                                          profile: {
                                            name: 'Camille Laurent',
                                            employeeId: 'EMP-04821',
                                            country: 'FR',
                                            seniority: 4,
                                            age: 29,
                                            monthsAccrued: 8,
                                            carryover: 3,
                                            taken: 2,
                                          },
                                          leaveType: 'PAID_ANNUAL',
                                          requested: 0,
                                          block: 0,
                                          hasCert: false,
                                          sickDays: 0,
                                          occupational: false,
                                          unpaidRequested: 0,
                                        });

  // -------------------------------------------------------------------
  // 2. The field tree. Profile fields are marked readonly() — the
  //    [formField] directive then applies the `readonly` HTML attribute
  //    to their bound inputs automatically, and readonly fields are
  //    skipped during validation, so they can never block the form.
  // -------------------------------------------------------------------
  leaveForm = form(this.leaveModel, (schemaPath) => {
    readonly(schemaPath.profile.name);
    readonly(schemaPath.profile.employeeId);
    readonly(schemaPath.profile.country);
    readonly(schemaPath.profile.seniority);
    readonly(schemaPath.profile.age);
    readonly(schemaPath.profile.monthsAccrued);
    readonly(schemaPath.profile.carryover);
    readonly(schemaPath.profile.taken);

    required(schemaPath.leaveType, {message: 'Select a leave type'});

    min(schemaPath.requested, 0, {message: 'Cannot be negative'});
    min(schemaPath.block, 0, {message: 'Cannot be negative'});
    min(schemaPath.sickDays, 0, {message: 'Cannot be negative'});
    min(schemaPath.unpaidRequested, 0, {message: 'Cannot be negative'});
  });

  // -------------------------------------------------------------------
  // 3. Step-completion signals (drive [completed] on each mat-step).
  //    A FieldTree isn't an AbstractControl, so instead of [stepControl]
  //    we compute completeness ourselves from form state.
  // -------------------------------------------------------------------
  step1Complete = computed(() => this.leaveForm.leaveType().valid());
  step2Complete = computed(() => this.leaveForm().valid());

  // -------------------------------------------------------------------
  // 4. The business-logic engine, as a pure computed() over the model.
  // -------------------------------------------------------------------
  decision = computed<DecisionResult>(() => {
    const m = this.leaveModel();
    switch (m.leaveType) {
      case 'PAID_ANNUAL':
        return this.computePaidAnnual(m);
      case 'SICK':
        return this.computeSick(m);
      case 'UNPAID':
        return this.computeUnpaid(m);
      case 'MATERNITY':
        return this.computeMaternity(m);
      default:
        return {
          leaveType: m.leaveType, country: m.profile.country, approved: false,
          reasons: ['Unknown leave type'], ledger: []
        };
    }
  });

  // -------------------------------------------------------------------
  onSubmit(): void {
    console.log('Leave request submitted:', {
      input: this.leaveModel(),
      decision: this.decision(),
    });
  }

  private computePaidAnnual(m: LeaveRequestData): DecisionResult {
    const {profile} = m;
    const ledger: LedgerEntry[] = [];
    let accrued: number;
    let bonus = 0;

    if (profile.country === 'FR') {
      // Fixed 2.5 days/month, no seniority bonus.
      accrued = profile.monthsAccrued * 2.5;
    } else {
      // TN: accrual rate depends on age.
      const rate = profile.age < 18 ? 2.0 : profile.age <= 20 ? 1.5 : 1.0;
      accrued = profile.monthsAccrued * rate;
      bonus = Math.floor(profile.seniority / 5); // +1 day per 5 completed years
    }

    ledger.push({label: 'Accrued this year', amount: round2(accrued)});
    if (profile.carryover) ledger.push(
      {label: 'Carried over from last year', amount: round2(profile.carryover)});
    if (profile.country === 'TN' && bonus) ledger.push(
      {label: 'Seniority bonus', amount: bonus});
    if (profile.taken) ledger.push(
      {label: 'Already taken', amount: -round2(profile.taken)});

    const baseBalance = profile.carryover + accrued - profile.taken;
    const totalBalance = profile.country === 'TN' ? baseBalance + bonus : baseBalance;

    const enoughBalance = m.requested <= totalBalance;
    const blockOk = profile.country === 'TN' ? m.block >= 6 : true;
    const approved = profile.country === 'TN' ? enoughBalance && blockOk : enoughBalance;

    const reasons: string[] = [
      enoughBalance
      ? `Sufficient balance: ${round2(totalBalance)} day(s) available.`
      : `Insufficient balance: requested ${m.requested}, only ${round2(
        totalBalance)} available.`,
    ];
    if (profile.country === 'TN') {
      reasons.push(
        blockOk
        ? 'Meets the Art. 118 six-day minimum continuous block.'
        : `Block of ${m.block} day(s) is below the six-day minimum (Art. 118).`
      );
    }

    ledger.push({label: 'Requested now', amount: -round2(m.requested)});

    return {
      leaveType: 'PAID_ANNUAL',
      country: profile.country,
      approved,
      reasons,
      ledger,
      totalBalanceAfter: approved ? round2(totalBalance - m.requested) :
                         round2(totalBalance),
    };
  }

  private computeSick(m: LeaveRequestData): DecisionResult {
    const {profile} = m;
    const approved = m.hasCert === true;
    const reasons: string[] = [
      approved ? 'Valid medical certificate on file.' :
      'Certificate required within 48 hours — none on file.',
    ];
    const ledger: LedgerEntry[] = [];

    if (approved && profile.country === 'FR') {
      const topUp = profile.seniority >= 1;
      reasons.push(
        topUp
        ? 'Eligible for employer sick-pay top-up (seniority ≥ 1 year).'
        : 'Not eligible for employer top-up (seniority < 1 year).'
      );

      const rate = m.occupational ? 2.5 : 2.0;
      let accrued = (m.sickDays / 30) * rate;
      if (!m.occupational && accrued > 24) {
        reasons.push('Accrual capped at 24 days (non-occupational illness).');
        accrued = 24;
      }
      ledger.push(
        {label: 'Paid leave accrued during sick leave', amount: round2(accrued)});
    } else if (approved && profile.country === 'TN') {
      reasons.push(
        'No supplemental paid-leave accrual; cash benefit routed through CNAM.');
    }

    return {leaveType: 'SICK', country: profile.country, approved, reasons, ledger};
  }

  private computeUnpaid(m: LeaveRequestData): DecisionResult {
    const {profile} = m;
    if (profile.country === 'FR') {
      return {
        leaveType: 'UNPAID',
        country: 'FR',
        approved: null,
        reasons: ['Not a statutory right in France — pending manager discretion.'],
        ledger: [],
      };
    }
    const approved = m.unpaidRequested <= 90;
    return {
      leaveType: 'UNPAID',
      country: 'TN',
      approved,
      reasons: [
        approved
        ? 'Within the 90-day cap (Art. 36, Convention Collective Cadre).'
        : `Exceeds the 90-day cap (Art. 36): requested ${m.unpaidRequested} day(s).`,
      ],
      ledger: [],
    };
  }

  // -------------------------------------------------------------------
  // 5. Submit

  private computeMaternity(m: LeaveRequestData): DecisionResult {
    const {profile} = m;
    const approved = m.hasCert === true;
    return {
      leaveType: 'MATERNITY',
      country: profile.country,
      approved,
      reasons: [
        approved ? 'Certificate on file — protected leave granted.' :
        'Certificate required to approve maternity leave.',
        'Tracked separately: does not deduct from the annual leave balance, and annual accrual continues uninterrupted.',
      ],
      ledger: [],
    };
  }
}
