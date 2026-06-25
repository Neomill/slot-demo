/** Raised when a debit exceeds the available balance. */
export class InsufficientFundsError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient funds: need ${required}, have ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

/** Raised when a spin result fails validation (untrusted provider output). */
export class InvalidSpinResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSpinResultError';
  }
}

/** Raised when the state machine is asked to make a transition it disallows. */
export class IllegalTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal state transition: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
  }
}
