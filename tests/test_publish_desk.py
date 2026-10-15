import importlib.util
import unittest
from pathlib import Path

p=Path(__file__).resolve().parents[1]/'scripts'/'publish_desk.py'
spec=importlib.util.spec_from_file_location('desk_publisher',p)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class DeskTests(unittest.TestCase):
    def test_feed_count_and_types(self):
        self.assertEqual(len(mod.FEEDS),54)
        self.assertEqual(len(set(x['id'] for x in mod.FEEDS)),54)
    def test_priority_matches_desktop(self):
        self.assertEqual(mod.editorial_priority('FOMC announces rate cut','Fed','Official direct'), 92)
        self.assertEqual(mod.editorial_priority('Routine local meeting','US News','Google News'),24)
    def test_rss_google_publisher(self):
        feed=next(x for x in mod.FEEDS if x['id']=='markets')
        rss=b'<rss><channel><item><title>Stocks surge - Reuters</title><link>https://news.google.com/rss/articles/test</link><pubDate>Wed, 14 Oct 2026 17:00:00 GMT</pubDate></item></channel></rss>'
        items=mod.parse(rss,feed)
        self.assertEqual(items[0]['source'],'Reuters')
        self.assertEqual(items[0]['title'],'Stocks surge')
    def test_no_missing_publish_date_became_now(self):
        rss=b'<rss><channel><item><title>Important news</title><link>https://example.com/article</link></item></channel></rss>'
        self.assertEqual(mod.parse(rss,mod.FEEDS[0]),[])
    def test_numeric_release_not_collapsed(self):
        self.assertFalse(mod.similar_title('The CPI rises 3.5 percent in September','The CPI rises 2.5 percent in September'))
        self.assertTrue(mod.similar_title('Federal Reserve releases major interest rate decision','Federal Reserve releases major interest rate decision'))
    def test_reject_entity_document(self):
        with self.assertRaises(ValueError):
            mod.parse(b'<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss></rss>',mod.FEEDS[0])
    def test_image_query_builder(self):
        item={'title':'Fed announces interest rate decision','source':'Federal Reserve','category':'Fed'}
        queries=mod.build_image_queries(item)
        self.assertTrue(any('Federal Reserve' in q for q in queries))
    def test_license_filter(self):
        self.assertTrue(mod.license_allowed('CC BY-SA 4.0'))
        self.assertTrue(mod.license_allowed('Public domain'))
        self.assertFalse(mod.license_allowed('CC BY-NC 4.0'))
        self.assertFalse(mod.license_allowed('All rights reserved'))

if __name__=='__main__':
    unittest.main()
