import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "../integrations/supabase/client.server";

describe("Supabase Client URL Normalization (PGRST125 prevention)", () => {
  it("leaves standard project URLs unchanged", () => {
    expect(normalizeSupabaseUrl("https://xyzcompany.supabase.co")).toBe(
      "https://xyzcompany.supabase.co",
    );
  });

  it("strips trailing slashes from project URLs", () => {
    expect(normalizeSupabaseUrl("https://xyzcompany.supabase.co/")).toBe(
      "https://xyzcompany.supabase.co",
    );
    expect(normalizeSupabaseUrl("https://xyzcompany.supabase.co///")).toBe(
      "https://xyzcompany.supabase.co",
    );
  });

  it("strips accidental /rest/v1 suffix that causes duplicate PostgREST paths", () => {
    expect(normalizeSupabaseUrl("https://xyzcompany.supabase.co/rest/v1")).toBe(
      "https://xyzcompany.supabase.co",
    );
    expect(normalizeSupabaseUrl("https://xyzcompany.supabase.co/rest/v1/")).toBe(
      "https://xyzcompany.supabase.co",
    );
  });

  it("strips surrounding quotes and whitespace from env variables", () => {
    expect(normalizeSupabaseUrl('  "https://xyzcompany.supabase.co/rest/v1/"  ')).toBe(
      "https://xyzcompany.supabase.co",
    );
    expect(normalizeSupabaseUrl("  'https://xyzcompany.supabase.co/'  ")).toBe(
      "https://xyzcompany.supabase.co",
    );
  });

  it("handles empty or undefined values safely", () => {
    expect(normalizeSupabaseUrl(undefined)).toBe("");
    expect(normalizeSupabaseUrl("")).toBe("");
  });
});
