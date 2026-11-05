import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { inviteCodeIn, inviteUrl, keepFirst, readSource, readTag, sourceSummary } from "@/lib/sources";
import {
  batches,
  contactsFromRows,
  emailLink,
  inviteMessage,
  normalizePhone,
  parseCsv,
  personalize,
  showPhone,
  textLink,
  whatsappLink,
} from "@/lib/contacts";
import { readXlsxRows } from "@/lib/xlsx";

describe("invite links (#68)", () => {
  it("carries whose invite it was, and only a real code", () => {
    expect(readTag("invite.k7m2qp")).toBe("invite.k7m2qp");
    expect(readSource("invite.k7m2qp")).toBe("invite");
    expect(inviteCodeIn("invite.k7m2qp")).toBe("k7m2qp");
    expect(inviteCodeIn("INVITE.K7M2QP")).toBe("k7m2qp");
    expect(readTag("invite")).toBeNull();
    expect(readTag("invite.nope")).toBeNull();
    expect(readTag("invite.k7m2q0")).toBeNull(); // 0 isn't in our codes
    expect(inviteCodeIn("flyer")).toBeNull();
    expect(readSource("in")).toBeNull();
  });

  it("keeps the first tag, invites included", () => {
    expect(keepFirst("invite.k7m2qp", "flyer")).toBe("invite.k7m2qp");
    expect(keepFirst("flyer", "invite.k7m2qp")).toBe("flyer");
    expect(keepFirst(null, "invite.k7m2qp")).toBe("invite.k7m2qp");
  });

  it("counts invites in where people came from", () => {
    expect(sourceSummary([{ source: "invite", count: 14 }, { source: "flyer", count: 2 }])).toBe("14 people came from invites, 2 from the flyer");
  });

  it("builds the link", () => {
    expect(inviteUrl("https://g.example/", "k7m2qp")).toBe("https://g.example/i/k7m2qp");
  });
});

describe("reading a contact list (#68)", () => {
  it("reads CSV with quotes, commas in names, CRLF, a BOM and blank rows", () => {
    const rows = parseCsv('﻿Name,Email,Phone\r\n"Rivera, Sam",sam@example.com,(416) 555-0134\r\n\r\nPriya,,\r\n');
    expect(rows[0]).toEqual(["Name", "Email", "Phone"]);
    expect(rows[1]).toEqual(["Rivera, Sam", "sam@example.com", "(416) 555-0134"]);
    expect(parseCsv('a;b\n"x ""y""";z')).toEqual([["a", "b"], ['x "y"', "z"]]);
  });

  it("finds the right columns by their usual names", () => {
    const { contacts, skipped } = contactsFromRows([
      ["", ""],
      ["First Name", "Last Name", "E-mail Address", "Mobile Phone"],
      ["Maya", "Chen", "Maya@Example.com", "416.555.0101"],
      ["Dev", "", "", "+44 7700 900123"],
      ["Nobody", "Here", "", ""],
      ["Maya", "Chen", "maya@example.com", "416-555-0101"], // a repeat
    ]);
    expect(contacts).toEqual([
      { name: "Maya Chen", email: "maya@example.com", phone: "14165550101" },
      { name: "Dev", email: null, phone: "447700900123" },
    ]);
    expect(skipped).toBe(1);
  });

  it("works without a header row, by what each cell looks like", () => {
    const { contacts } = contactsFromRows([
      ["Rosa", "rosa@gmail.com", "6045550188"],
      ["jordan@example.org"],
    ]);
    expect(contacts).toEqual([
      { name: "Rosa", email: "rosa@gmail.com", phone: "16045550188" },
      { name: "", email: "jordan@example.org", phone: null },
    ]);
  });

  it("understands common phone formats", () => {
    expect(normalizePhone("(416) 555-0134")).toBe("14165550134");
    expect(normalizePhone("1-416-555-0134")).toBe("14165550134");
    expect(normalizePhone("+1 416 555 0134 ext. 22")).toBe("14165550134");
    expect(normalizePhone("0044 20 7946 0958")).toBe("442079460958");
    expect(normalizePhone("4165550134")).toBe("14165550134");
    expect(normalizePhone("555-0134")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(showPhone("14165550134")).toBe("+1 416-555-0134");
    expect(showPhone("447700900123")).toBe("+447700900123");
  });

  it("reads an Excel file's first sheet, shared text and numbers", () => {
    const xml = (s: string) => strToU8(`<?xml version="1.0" encoding="UTF-8"?>${s}`);
    const xlsx = zipSync({
      "xl/workbook.xml": xml('<workbook><sheets><sheet name="People" sheetId="1" r:id="rId7"/></sheets></workbook>'),
      "xl/_rels/workbook.xml.rels": xml('<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/sheet2.xml"/></Relationships>'),
      "xl/sharedStrings.xml": xml("<sst><si><t>Name</t></si><si><t>Phone</t></si><si><r><t>Sam </t></r><r><t>&amp; Alex</t></r></si></sst>"),
      "xl/worksheets/sheet1.xml": xml('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>wrong sheet</t></is></c></row></sheetData></worksheet>'),
      "xl/worksheets/sheet2.xml": xml(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>4.1655501E+9</v></c></row><row r="3"/></sheetData></worksheet>',
      ),
    });
    const rows = readXlsxRows(xlsx);
    expect(rows[0]).toEqual(["Name", "", "Phone"]);
    expect(rows[1]).toEqual(["Sam & Alex", "", "4165550100"]);
    expect(contactsFromRows(rows).contacts).toEqual([{ name: "Sam & Alex", email: null, phone: "14165550100" }]);
  });
});

describe("ready-written messages (#68)", () => {
  const msg = inviteMessage("Fix the crossing", "Toronto, ON", "https://g.example/i/k7m2qp");

  it("includes the link and can be personalized", () => {
    expect(msg).toContain("https://g.example/i/k7m2qp");
    expect(personalize(msg, "Maya Chen")).toMatch(/^Hi Maya!/);
    expect(personalize("Hello all", "Maya")).toBe("Hello all");
    expect(personalize(msg, "")).toBe(msg);
  });

  it("opens the person's own apps with the message", () => {
    expect(whatsappLink("Hi & bye")).toBe("https://wa.me/?text=Hi%20%26%20bye");
    expect(whatsappLink("Hi", "14165550134")).toBe("https://wa.me/14165550134?text=Hi");
    expect(textLink("Hi", "14165550134")).toBe("sms:+14165550134?&body=Hi");
    expect(textLink("Hi")).toBe("sms:?&body=Hi");
    expect(emailLink({ subject: "Join us", body: "Hi", bcc: ["a@x.com", "b+1@y.com"] })).toBe("mailto:?bcc=a%40x.com,b%2B1%40y.com&subject=Join%20us&body=Hi");
  });

  it("splits big email lists into groups", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
