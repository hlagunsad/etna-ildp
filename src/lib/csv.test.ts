import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv";
import { toCsv } from "./reporting";

describe("parseCsv", () => {
  it("parses a simple table", () => {
    expect(parseCsv("a,b\nx,y")).toEqual({ headers: ["a", "b"], rows: [{ a: "x", b: "y" }] });
  });
  it("trims headers but not values", () => {
    expect(parseCsv(" a , b \n x , y ")).toEqual({ headers: ["a", "b"], rows: [{ a: " x ", b: " y " }] });
  });
  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,b\n"x,1",y')).toEqual({ headers: ["a", "b"], rows: [{ a: "x,1", b: "y" }] });
  });
  it("unescapes doubled quotes", () => {
    expect(parseCsv('a,b\n"he said ""hi""",y')).toEqual({ headers: ["a", "b"], rows: [{ a: 'he said "hi"', b: "y" }] });
  });
  it("keeps newlines inside quoted fields (LF and CRLF)", () => {
    expect(parseCsv('a,b\n"x\ny",z').rows[0]).toEqual({ a: "x\ny", b: "z" });
    expect(parseCsv('a,b\r\n"x\r\ny",z').rows[0]).toEqual({ a: "x\r\ny", b: "z" });
  });
  it("treats CRLF the same as LF and ignores a trailing newline", () => {
    expect(parseCsv("a,b\r\nx,y\r\n")).toEqual({ headers: ["a", "b"], rows: [{ a: "x", b: "y" }] });
    expect(parseCsv("a,b\nx,y\n").rows).toHaveLength(1);
  });
  it("skips fully-blank lines between records", () => {
    expect(parseCsv("a,b\n\nx,y").rows).toEqual([{ a: "x", b: "y" }]);
  });
  it("pads short rows and drops extra fields on long rows", () => {
    expect(parseCsv("a,b,c\nx,y")).toEqual({ headers: ["a", "b", "c"], rows: [{ a: "x", b: "y", c: "" }] });
    expect(parseCsv("a,b\nx,y,z").rows[0]).toEqual({ a: "x", b: "y" });
  });
  it("handles empty and header-only input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("a,b")).toEqual({ headers: ["a", "b"], rows: [] });
    expect(parseCsv("a,b\n")).toEqual({ headers: ["a", "b"], rows: [] });
  });
  it("round-trips with toCsv (comma, quote, and newline fixtures)", () => {
    const headers = ["name", "note"];
    const rowsArr = [
      ["Ann", "hi, there"],
      ["Bob", 'say "yo"'],
      ["Cara", "line1\nline2"],
    ];
    const parsed = parseCsv(toCsv(headers, rowsArr));
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toEqual([
      { name: "Ann", note: "hi, there" },
      { name: "Bob", note: 'say "yo"' },
      { name: "Cara", note: "line1\nline2" },
    ]);
  });
});
