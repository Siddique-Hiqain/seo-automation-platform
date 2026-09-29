from app.services.dataforseo import DataForSEOClient


client = DataForSEOClient()


metrics = client.search_keywords(
    [
        "shopify seo checklist",
        "local seo services"
    ]
)


print(metrics)