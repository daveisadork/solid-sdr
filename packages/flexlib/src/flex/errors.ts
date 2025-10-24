export class FlexError extends Error {
  override readonly name: string = "FlexError";
  constructor(message: string) {
    super(message);
  }
}

export class FlexCommandRejectedError extends FlexError {
  override readonly name: string = "FlexCommandRejectedError";
  readonly codeDescription?: string;
  constructor(
    message: string,
    readonly response: {
      readonly sequence: number;
      readonly code?: number;
      readonly raw: string;
      readonly message?: string;
    },
    description?: string,
  ) {
    super(message);
    this.codeDescription = description;
  }
}

export class FlexClientClosedError extends FlexError {
  override readonly name: string = "FlexClientClosedError";
  constructor() {
    super("Flex radio session is closed");
  }
}

export class FlexDiscoveryUnavailableError extends FlexError {
  override readonly name: string = "FlexDiscoveryUnavailableError";
  constructor() {
    super("Discovery adapter is not configured");
  }
}

export class FlexStateUnavailableError extends FlexError {
  override readonly name: string = "FlexStateUnavailableError";
  constructor(message: string) {
    super(message);
  }
}
