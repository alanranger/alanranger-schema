# Alan Ranger Schema Hosting

Public repository hosting structured data (JSON-LD) for alanranger.com Squarespace pages.

## Files

- `lessons-schema.json` → `/beginners-photography-lessons`
- `workshops-schema.json` → `/photographic-workshops-near-me`
- `blog-schema.json` → `/blog-on-photography`

## Hosting

- **GitHub Pages**: https://alanranger.github.io/alanranger-schema/
- **Custom Domain**: https://schema.alanranger.com/
- **Auto-sync**: Enabled via GitHub Actions

## Usage

### Squarespace Integration

Add these script tags to your Squarespace page header code:

**For Courses Page** (`/beginners-photography-lessons`):
```html
<!-- Lessons Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/lessons-schema.json">
</script>
```

**For Workshops Page** (`/photographic-workshops-near-me`):
```html
<!-- Workshops Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/workshops-schema.json">
</script>
```

**For Blog Index Page** (`/blog-on-photography`):
```html
<!-- Blog Index Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/blog-schema.json">
</script>
```

### Auto-Sync

Schema files are automatically synced from the local Event Schema Generator tool via GitHub Actions. When you export schema JSON files, they are automatically pushed to this repository and deployed to GitHub Pages.

## Validation

Validate hosted JSON files with:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

## Repository Structure

```
alanranger-schema/
├── lessons-schema.json
├── workshops-schema.json
├── blog-schema.json
├── .github/
│   └── workflows/
│       └── update-schema.yml
├── CNAME
└── README.md
```

## DNS Configuration

Add a CNAME record at your DNS provider:

```
schema CNAME alanranger.github.io
```

Wait for DNS propagation (usually 5-30 minutes).

## Manual page schemas (not in products-manifest)

- **Mentoring** (`/photography-mentoring-online-assignments`): reviews are pasted manually into Squarespace page header as a Service+Product `#service` node (Alan decision 2026-10-06). File `photography-mentor-online-monthly-mentoring_schema.json` is kept for generation/reference only — **not** listed in `products-manifest.json`.
- **1×2hr F2F** (`/photography-services-near-me/2hr-private-photography-classes-2hr`): page currently 404; schema file kept, **excluded from manifest** until the Squarespace product is restored. Reviews live on the four-pack product page.
