import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "images", "social", "wovo-cover-background-v1.png");
const cover = path.join(root, "public", "images", "social", "wovo-facebook-cover.png");
const avatar = path.join(root, "public", "images", "social", "wovo-social-avatar.png");

await fs.access(source);

const coverOverlay = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="624" viewBox="0 0 1640 624">
  <style>
    .sans{font-family:Arial,Helvetica,sans-serif}
    .serif{font-family:Georgia,'Times New Roman',serif}
  </style>
  <g transform="translate(112 84)">
    <rect width="62" height="62" rx="18" fill="#191714"/>
    <path d="M13 18h9l6 25 5-19h1l5 19 6-25h9l-10 29h-9l-2-6-1 6h-9L13 18Z" fill="#F3EFE6"/>
    <circle cx="51" cy="13" r="7" fill="#F05A3A"/>
    <text x="84" y="43" class="sans" font-size="31" font-weight="800" letter-spacing="5" fill="#191714">WOVO MEDIA</text>
  </g>
  <g transform="translate(112 245)">
    <text class="sans" font-size="17" font-weight="800" letter-spacing="4" fill="#D94326">THE WEEKLY MARKETING WORKSPACE</text>
    <text y="70" class="serif" font-size="56" font-weight="600" letter-spacing="-2" fill="#191714">Make the week</text>
    <text y="128" class="serif" font-size="56" font-weight="600" letter-spacing="-2" fill="#191714">make sense.</text>
    <text y="184" class="sans" font-size="22" fill="#5F574D">Create &#183; Approve &#183; Schedule &#183; Move forward</text>
  </g>
  <g transform="translate(112 558)">
    <rect width="226" height="40" rx="20" fill="#F05A3A"/>
    <text x="113" y="27" text-anchor="middle" class="sans" font-size="17" font-weight="800" fill="#191714">WOVOMEDIA.COM</text>
    <text x="252" y="27" class="sans" font-size="17" font-weight="700" fill="#5F574D">Serving businesses worldwide</text>
  </g>
</svg>`);

await sharp(source)
  .resize(1640, 624, { fit: "cover", position: "center" })
  .composite([{ input: coverOverlay }])
  .png({ compressionLevel: 9 })
  .toFile(cover);

const avatarSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="116" fill="#191714"/>
  <path d="M96 142h72l45 200 43-148h1l43 148 44-200h72l-78 228h-72l-10-39-10 39h-72L96 142Z" fill="#F3EFE6"/>
  <circle cx="412" cy="104" r="42" fill="#F05A3A"/>
</svg>`);

await sharp(avatarSvg).png({ compressionLevel: 9 }).toFile(avatar);

const [coverMeta, avatarMeta] = await Promise.all([sharp(cover).metadata(), sharp(avatar).metadata()]);
console.log(JSON.stringify({
  cover: { path: cover, width: coverMeta.width, height: coverMeta.height },
  avatar: { path: avatar, width: avatarMeta.width, height: avatarMeta.height },
}));
