import sys
import unittest
import datetime as dt
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
import update_news

class FeedTests(unittest.TestCase):
    def setUp(self):self.now=dt.datetime(2026,10,14,tzinfo=dt.timezone.utc)
    def test_rss_publisher_metadata(self):
        xml=b'<rss><channel><item><title>Agency releases a statement</title><link>https://example.gov/a</link><pubDate>Wed, 14 Oct 2026 00:00:00 GMT</pubDate><description>Primary statement</description></item></channel></rss>'
        a=update_news.parse_rss(xml,{'name':'Example Agency','kind':'Official direct','category':'Government'},self.now)[0]
        self.assertEqual(a['source'],'Example Agency')
        self.assertEqual(a['summary'],'Primary statement')
        self.assertEqual(a['category'],'Government')
    def test_official_source_short_excerpt_is_retained(self):
        xml=b'<rss><channel><item><title>Rule published</title><link>https://example.gov/rule</link><pubDate>Wed, 14 Oct 2026 00:00:00 GMT</pubDate><description>Agency notice</description></item></channel></rss>'
        item=update_news.parse_rss(xml,{'name':'Example Agency','kind':'Official direct','category':'Government'},self.now)[0]
        self.assertEqual(item['summary'],'Agency notice')
    def test_google_news_publisher_attribute(self):
        xml=b'<rss><channel><item><title>Example headline - Publisher X</title><link>https://news.google.com/a</link><pubDate>Wed, 14 Oct 2026 00:00:00 GMT</pubDate><source url="https://publisher.example">Publisher X</source></item></channel></rss>'
        a=update_news.parse_rss(xml,{'name':'Google News','kind':'Discovery','category':'World'},self.now)[0]
        self.assertEqual(a['source'],'Publisher X')
        self.assertEqual(a['summary'],'')
    def test_missing_date_not_stamped_as_fetch_time(self):
        xml=b'<rss><channel><item><title>Undated release</title><link>https://example.gov/undated</link></item></channel></rss>'
        self.assertEqual(update_news.parse_rss(xml,{'name':'Agency','kind':'Official direct','category':'Government'},self.now),[])
    def test_garbage_date_not_stamped_as_fetch_time(self):
        xml=b'<rss><channel><item><title>Bad date</title><link>https://example.gov/bad</link><pubDate>unknown</pubDate></item></channel></rss>'
        self.assertEqual(update_news.parse_rss(xml,{'name':'Agency','kind':'Official direct','category':'Government'},self.now),[])
    def test_actual_pubdate_is_parsed_instead_of_fetch_time(self):
        xml=b'<rss><channel><item><title>Real date</title><link>https://example.gov/real</link><pubDate>Mon, 12 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>'
        story=update_news.parse_rss(xml,{'name':'Agency','kind':'Official direct','category':'Government'},self.now)[0]
        self.assertEqual(story['published_at'],'2026-10-12T08:00:00Z')
    def test_reject_xml_entity(self):
        with self.assertRaises(ValueError):update_news.parse_rss(b'<!DOCTYPE html><rss></rss>',{'name':'Agency','kind':'Official direct','category':'Government'},self.now)
    def test_reject_unsafe_urls(self):
        xml=b'<rss><channel><item><title>Bad</title><link>javascript:alert(1)</link></item></channel></rss>'
        self.assertEqual(update_news.parse_rss(xml,{'name':'Agency','kind':'Official direct','category':'Government'},self.now),[])
if __name__=='__main__':unittest.main()
