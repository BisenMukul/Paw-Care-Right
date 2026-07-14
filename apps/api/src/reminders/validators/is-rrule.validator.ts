import { isValidRRule } from "@pawcareright/types";
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

/**
 * First custom class-validator decorator in the repo (T053 plan). Delegates
 * to the shared `isValidRRule` parser (`@pawcareright/types`) so the DTO
 * layer here, mobile's T060 schedule builder, and the future T055/T056
 * recurrence engine all agree on "valid rrule" (plan decision 2) — no
 * parsing logic is duplicated in this file.
 */
@ValidatorConstraint({ name: "isRRule", async: false })
class IsRRuleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && isValidRRule(value);
  }

  defaultMessage(): string {
    return "rrule must be a valid recurrence rule";
  }
}

/** Validates a property as an RFC5545-subset `RRULE` string (see `@pawcareright/types` `parseRRule`). */
export function IsRRule(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      ...(validationOptions !== undefined ? { options: validationOptions } : {}),
      validator: IsRRuleConstraint,
    });
  };
}
