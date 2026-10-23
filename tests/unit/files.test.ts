import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectFileType } from "@/lib/files/detect";
import { sanitizeImage } from "@/lib/files/sanitize";
import { cleanFileName } from "@/lib/files/service";
import { certificateInput } from "@/lib/certificates/schema";
import { escapeLike } from "@/lib/certificates/queries";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("detectFileType", () => {
  it("recognizes PDF, PNG, JPEG and WebP by magic bytes", () => {
    expect(detectFileType(ascii("%PDF-1.7 ..."))?.mime).toBe("application/pdf");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))?.mime).toBe(
      "image/png",
    );
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe("image/jpeg");
    expect(detectFileType(ascii("RIFF\0\0\0\0WEBPVP8 "))?.mime).toBe("image/webp");
  });

  it("rejects anything else, whatever the name says", () => {
    expect(detectFileType(ascii("hello, I am not a pdf"))).toBeNull();
    expect(detectFileType(ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectFileType(ascii("GIF89a"))).toBeNull();
    expect(detectFileType(bytes())).toBeNull();
  });
});

describe("sanitizeImage", () => {
  it("removes EXIF metadata from a JPEG", async () => {
    const withExif = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#0f5e57" },
    })
      .jpeg()
      .withExif({ IFD0: { Artist: "Someone", Copyright: "Secret location" } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const clean = await sanitizeImage(withExif, { mime: "image/jpeg", ext: "jpg", isImage: true });
    const meta = await sharp(clean).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe("jpeg");
  });

  it("rejects bytes that only look like an image", async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    await expect(
      sanitizeImage(fake, { mime: "image/jpeg", ext: "jpg", isImage: true }),
    ).rejects.toThrow();
  });
});

describe("cleanFileName", () => {
  it("strips paths and control characters and uses the detected extension", () => {
    expect(cleanFileName("../../etc/passwd.pdf", "pdf")).toBe("passwd.pdf");
    expect(cleanFileName("C:\\fake\\cert.exe", "png")).toBe("cert.png");
    expect(cleanFileName("a\u0000b.jpg", "jpg")).toBe("ab.jpg");
    expect(cleanFileName("", "pdf")).toBe("certificate.pdf");
  });
});

describe("certificateInput", () => {
  const base = {
    title: " AWS Cloud Practitioner ",
    issuer_name: "Amazon",
    source_platform: "",
    description: "",
    credential_id: "",
    credential_url: "",
    issued_at: "",
    expiration_status: "unknown",
    expires_at: "",
    skills: "",
  };

  it("trims text and turns empty optional fields into null", () => {
    const r = certificateInput.parse(base);
    expect(r.title).toBe("AWS Cloud Practitioner");
    expect(r.description).toBeNull();
    expect(r.hidden_from_portfolio).toBe(false);
  });

  it("splits skills on commas and caps them at 30", () => {
    expect(certificateInput.parse({ ...base, skills: " AWS, Cloud ,, " }).skills).toEqual(["AWS", "Cloud"]);
    const many = Array.from({ length: 31 }, (_, i) => `s${i}`).join(",");
    expect(certificateInput.safeParse({ ...base, skills: many }).success).toBe(false);
  });

  it("rejects non-http credential URLs", () => {
    expect(certificateInput.safeParse({ ...base, credential_url: "javascript:alert(1)" }).success).toBe(false);
    expect(certificateInput.safeParse({ ...base, credential_url: "https://example.com/b" }).success).toBe(true);
  });

  it("enforces expiration rules", () => {
    expect(certificateInput.safeParse({ ...base, expiration_status: "has_date" }).success).toBe(false);
    expect(
      certificateInput.safeParse({
        ...base,
        expiration_status: "has_date",
        issued_at: "2025-06-01",
        expires_at: "2025-01-01",
      }).success,
    ).toBe(false);
    // A date left in the form is dropped when the status isn't has_date.
    expect(
      certificateInput.parse({ ...base, expiration_status: "never", expires_at: "2030-01-01" }).expires_at,
    ).toBeNull();
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
  });
});
