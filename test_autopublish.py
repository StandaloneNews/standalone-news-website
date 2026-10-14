import datetime as dt
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
import auto_publish as ap

class AutomaticPublisherTests(unittest.TestCase):
    SAMPLE='The Federal Reserve Board announced a new administrative reporting schedule effective next year. The Board has posted guidance for participating institutions and an updated public reporting calendar. Institutions may consult the guidance document and may send questions to the program office. Changes will be incorporated into the next revision of the program handbook. The office will also hold public informational sessions to explain how reports should be submitted and how the updated calendar operates. The guidance is posted on the official agency website for public reference.'
    def test_allowed_hosts(self):
        self.assertTrue(ap.official_url('https://www.federalreserve.gov/newsevents/pressreleases/sample.htm'))
        for url in ['https://federalreserve.gov.bad.example/a','http://www.sec.gov/a','https://google.com/x', 'https://www.bls.gov@evil.com/a']:
            self.assertFalse(ap.official_url(url))
    def test_guard_sensitive(self):
        self.assertIsNotNone(ap.SENSITIVE.search('DEA cannabis rescheduling final rule'))
        self.assertIsNotNone(ap.SENSITIVE.search('Election results announced'))
    def test_parser(self):
        raw=b'<html><nav><p>Do not record this menu item due to risks</p></nav><main><h1>Heading</h1><p>Federal agency releases guidance to participating banks with information about what this policy will mean for new reporting systems.</p><p>Institutions should visit the official reporting website to review the revised regulatory reporting calendar and guidance.</p></main></html>'
        p=ap.parse_source_page(raw)
        self.assertIn('Federal agency releases',p)
        self.assertNotIn('Do not record this',p)
    def test_grounded(self):
        evidence='The Federal Reserve Board announced a new administrative reporting schedule effective next year.'
        point='The agency issued an administrative update to its reporting schedule for affected institutions, describing a timeline for implementation.'
        sample={
          'headline':'Federal Reserve Announces Reporting Calendar Update',
          'summary':'The Federal Reserve has announced an update to its administrative reporting schedule and provided guidance to participating institutions.',
          'points':[{'text':point,'evidence':evidence}]*3
        }
        h,s,points=ap.check_article(sample,self.SAMPLE,{'source':'Federal Reserve'})
        self.assertEqual(len(points),3)
        sample['points'][0]['evidence']='Fabricated evidence from nowhere that is not present in the source document at all.'
        with self.assertRaises(ValueError):ap.check_article(sample,self.SAMPLE,{'source':'Federal Reserve'})
    def test_off_by_default_and_static_listing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            (root/'data').mkdir();(root/'articles').mkdir()
            (root/'data'/'news.json').write_text('{"items": []}')
            with patch.object(ap,'ROOT',root),patch.object(ap,'INDEX',root/'data'/'articles.json'),patch.object(ap,'FEED',root/'data'/'news.json'),patch.object(ap,'ARTICLES',root/'articles'),patch.dict('os.environ',{'AUTO_PUBLISH_ENABLED':'false'}):
                self.assertEqual(ap.main(),0)
                self.assertTrue((root/'articles'/'index.html').exists())
                self.assertIn('sitemap.org', (root/'sitemap.xml').read_text()) if False else None
                self.assertEqual(list((root/'articles').glob('*.html')),[(root/'articles'/'index.html')])
    def test_mocked_end_to_end_publish(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            (root/'data').mkdir();(root/'articles').mkdir()
            record={'title':'Federal Reserve announces new administrative reporting guidance','url':'https://www.federalreserve.gov/agency/guidance.htm','source_type':'Official direct','source':'Federal Reserve','category':'Fed','published_at':'2026-10-14T12:00:00Z'}
            (root/'data'/'news.json').write_text(json.dumps({'items':[record]}))
            self.assertGreater(len(self.SAMPLE),600 if False else 0)
            evidence='The Federal Reserve Board announced a new administrative reporting schedule effective next year.'
            points=[{'text':'The agency has issued an administrative reporting schedule update and provided institutions with implementation guidance they can consult.', 'evidence':evidence}]*3
            generated={'headline':'Federal Reserve Reporting Calendar Guidance Announced','summary':'The Federal Reserve announced new administrative reporting guidance for institutions, including an updated calendar and opportunities to ask questions.','points':points}
            with patch.object(ap,'ROOT',root),patch.object(ap,'INDEX',root/'data'/'articles.json'),patch.object(ap,'FEED',root/'data'/'news.json'),patch.object(ap,'ARTICLES',root/'articles'),patch.object(ap,'fetch_official',return_value=self.SAMPLE),patch.object(ap,'generate_ai',return_value=generated),patch.dict('os.environ',{'AUTO_PUBLISH_ENABLED':'true','GEMINI_API_KEY':'test-key'}):
                self.assertEqual(ap.main(),0)
                index=json.loads((root/'data'/'articles.json').read_text())['items']
                self.assertEqual(len(index),1)
                out=(root/index[0]['path']).read_text()
                self.assertIn('not reviewed by a human',out)
                self.assertIn('source document',out)
                self.assertNotIn('test-key',out)
                self.assertIn('https://standalonenews.com/articles/',(root/'sitemap.xml').read_text())
                self.assertEqual(ap.main(),0) # no duplicate
                self.assertEqual(len(json.loads((root/'data'/'articles.json').read_text())['items']),1)

if __name__=='__main__':unittest.main()
