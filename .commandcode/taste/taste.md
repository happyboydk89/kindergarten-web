# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/


# dates
- Always send and receive dates as YYYY-MM-DD strings. Never parse into JavaScript Date objects to avoid UTC timezone offset issues. Confidence: 0.85

# currency
- Format Vietnamese đồng amounts with comma separators and the "đ" suffix, e.g., "3,500,000 đ". Confidence: 0.70

