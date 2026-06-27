/** Raised when a debit exceeds the available balance. */
export class InsufficientFundsError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient funds: need ${required}, have ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

/** Raised when the state machine is asked to make a transition it disallows. */
export class IllegalTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal state transition: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

/** Raised on an invalid bonus action (unknown tier, or buying while not idle/base). */
export class InvalidBonusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBonusError';
  }
}
