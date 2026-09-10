import { describe, expect, it } from "vitest"
import {
  CARD_BIN,
  CARD_NUMBER_LENGTH,
  canTransition,
  generateCardNumber,
  isLuhnValid,
  luhnCheckDigit,
  maskCardNumber,
  validateIssueCardInput,
} from "./cards"

/**
 * Every generated number must pass Luhn and start on the 4242 test BIN —
 * that is the whole reason this file exists. The state machine is tested
 * exhaustively because "cancelled is terminal" is a one-line rule with a
 * lot of ways to get it backwards.
 */

describe("luhnCheckDigit / isLuhnValid", () => {
  it("computes the known check digit for a real test PAN prefix", () => {
    // 4242424242424242 is a well-known Luhn-valid test number.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
    expect(isLuhnValid("4242424242424242")).toBe(true)
  })

  it("rejects a number with a flipped check digit", () => {
    expect(isLuhnValid("4242424242424243")).toBe(false)
  })

  it("rejects anything that isn't all digits", () => {
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("starts with the 4242 test BIN and is 16 digits", () => {
    const number = generateCardNumber()
    expect(number).toHaveLength(CARD_NUMBER_LENGTH)
    expect(number.startsWith(CARD_BIN)).toBe(true)
  })

  it("always passes its own Luhn check", () => {
    for (let i = 0; i < 20; i++) {
      expect(isLuhnValid(generateCardNumber())).toBe(true)
    }
  })

  it("is deterministic given a fixed random source, and varies with a different one", () => {
    const constant = () => 0.5
    expect(generateCardNumber(constant)).toBe(generateCardNumber(constant))

    let n = 0
    const counting = () => (n++ % 10) / 10
    const a = generateCardNumber(counting)
    const b = generateCardNumber(counting)
    expect(a).not.toBe(b)
  })
})

describe("maskCardNumber", () => {
  it("shows only the last four digits", () => {
    expect(maskCardNumber("9012")).toBe("•••• 9012")
  })
})

describe("canTransition", () => {
  it("allows active and frozen to flip back and forth", () => {
    expect(canTransition("active", "frozen")).toBe(true)
    expect(canTransition("frozen", "active")).toBe(true)
  })

  it("allows either active or frozen to cancel", () => {
    expect(canTransition("active", "cancelled")).toBe(true)
    expect(canTransition("frozen", "cancelled")).toBe(true)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })

  it("rejects transitioning a status to itself", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })
})

describe("validateIssueCardInput", () => {
  const valid = {
    nickname: "Ad spend",
    merchantId: "mch_01",
    merchantExists: true,
    limit: 25000,
    currency: "USD",
    category: "advertising",
  }

  it("accepts a fully valid input", () => {
    expect(validateIssueCardInput(valid)).toBeNull()
  })

  it("rejects a missing or blank nickname", () => {
    expect(validateIssueCardInput({ ...valid, nickname: "" })).toMatch(/nickname/i)
    expect(validateIssueCardInput({ ...valid, nickname: "   " })).toMatch(/nickname/i)
  })

  it("rejects a missing merchant", () => {
    expect(validateIssueCardInput({ ...valid, merchantId: "" })).toMatch(/merchant/i)
  })

  it("rejects an unknown merchant id", () => {
    expect(
      validateIssueCardInput({ ...valid, merchantId: "mch_ghost", merchantExists: false }),
    ).toMatch(/unknown merchant/i)
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssueCardInput({ ...valid, limit: 0 })).toMatch(/limit/i)
    expect(validateIssueCardInput({ ...valid, limit: -100 })).toMatch(/limit/i)
  })

  it("rejects a non-integer limit", () => {
    expect(validateIssueCardInput({ ...valid, limit: 250.5 })).toMatch(/limit/i)
  })

  it("accepts the limit at exactly the maximum and rejects one minor unit over", () => {
    expect(validateIssueCardInput({ ...valid, limit: 5_000_000 })).toBeNull()
    expect(validateIssueCardInput({ ...valid, limit: 5_000_001 })).toMatch(/limit/i)
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(validateIssueCardInput({ ...valid, currency: "JPY" })).toMatch(/currency/i)
  })

  it("rejects a currency that doesn't match the merchant's own", () => {
    expect(
      validateIssueCardInput({ ...valid, currency: "GBP", merchantCurrency: "USD" }),
    ).toMatch(/merchant's currency/i)
  })

  it("accepts a currency that matches the merchant's own", () => {
    expect(
      validateIssueCardInput({ ...valid, currency: "USD", merchantCurrency: "USD" }),
    ).toBeNull()
  })

  it("rejects a category outside the allowlist", () => {
    expect(validateIssueCardInput({ ...valid, category: "groceries" })).toMatch(/category/i)
  })
})
