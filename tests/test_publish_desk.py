import importlib.util
import unittest
from unittest import mock
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


    def test_repeated_photo_not_assigned_to_two_featured_headlines(self):
        recent=[{'id':'a','url':'https://example.com/a','title':'Federal Reserve announces rates'},
                {'id':'b','url':'https://example.com/b','title':'Federal Reserve meets this week'}]
        photo={'thumb_url':'https://upload.wikimedia.org/a.jpg','page_url':'https://commons.wikimedia.org/wiki/File:Federal',
               'license':'CC BY 4.0','source':'Wikimedia Commons','matched_query':'Federal Reserve building Washington DC'}
        with mock.patch.object(mod,'match_image',return_value=photo):
            items,count=mod.attach_images(recent,recent)
        self.assertEqual(count,1)
        self.assertTrue(items[0].get('image'))
        self.assertIsNone(items[1].get('image'))

    def test_preserve_valid_previous_image(self):
        photo={'thumb_url':'https://upload.wikimedia.org/wikipedia/commons/test.jpg',
               'page_url':'https://commons.wikimedia.org/wiki/File:Federal',
               'source':'Wikimedia Commons','license':'CC BY 4.0',
               'matched_query':'Federal Reserve building Washington DC'}
        items,count=mod.attach_images([{'id':'a','url':'https://example.com/a','title':'Federal Reserve makes statement'}],
                                       [{'id':'a'}],previous=[{'url':'https://example.com/a','image':photo}])
        self.assertEqual(count,1)
        self.assertEqual(items[0]['image'],photo)

    def test_pexels_without_key_is_disabled(self):
        with mock.patch.object(mod,'PEXELS_KEY',''):
            self.assertEqual(mod.search_pexels('Federal Reserve'),[])

class ImageQualityTests(unittest.TestCase):
    def test_generic_headline_uses_artwork(self):
        self.assertEqual(mod.candidate_queries({'title':'Stocks fall as inflation jumps - Reuters','category':'Markets','source':'Reuters'}),[])
    def test_named_institution_gets_query(self):
        self.assertIn('Federal Reserve building Washington DC',mod.candidate_queries({'title':'Federal Reserve announces rate decision','category':'Fed'}))
    def test_reuse_requires_matching_specific_subject_and_license(self):
        img={'thumb_url':'https://commons.wikimedia.org/img.jpg','page_url':'https://commons.wikimedia.org/wiki/File:Fed',
             'source':'Wikimedia Commons','license':'CC BY-SA 4.0','matched_query':'Federal Reserve building Washington DC'}
        self.assertTrue(mod.image_is_safe(img,mod.candidate_queries({'title':'Federal Reserve releases report'})))
        self.assertFalse(mod.image_is_safe(img,mod.candidate_queries({'title':'Nasdaq drops in afternoon trading'})))
        img['license']='CC BY-NC 4.0'
        self.assertFalse(mod.image_is_safe(img,['Federal Reserve building Washington DC']))

if __name__=='__main__':
    unittest.main()
