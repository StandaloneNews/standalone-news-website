import importlib.util
import unittest
from datetime import datetime,timezone
from pathlib import Path
from unittest import mock
p=Path(__file__).resolve().parents[1]/'scripts'/'update_sports.py'
spec=importlib.util.spec_from_file_location('sports',p)
sports=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sports)
NOW=datetime(2026,10,17,23,0,tzinfo=timezone.utc)
class SportsTests(unittest.TestCase):
    def test_supported_leagues_include_ufc(self):
        self.assertIn('ufc',[x[0] for x in sports.LEAGUES]);self.assertIn('nfl',[x[0] for x in sports.LEAGUES])
    def test_month_boundary_and_ufc_year(self):
        self.assertEqual(sports.month_keys(datetime(2026,1,12,tzinfo=timezone.utc)),['202512','202601','202602'])
        urls=sports.requests_for_league(sports.LEAGUES[0],NOW)
        self.assertTrue(any('dates=2026' in u for _,u in urls))
    def test_upcoming_nfl(self):
        item={'id':'100','name':'Chiefs at Ravens','date':'2026-10-18T17:00Z','status':{'type':{'state':'pre','shortDetail':'Sun 1:00 PM ET'}},
              'competitions':[{'competitors':[{'team':{'displayName':'Ravens'}},{'team':{'displayName':'Chiefs'}}]}]}
        out=sports.parse_event(item,'nfl',NOW)
        self.assertEqual(out['state'],'upcoming');self.assertEqual(out['participants'][0]['name'],'Ravens')
    def test_final_score(self):
        event={'id':'101','name':'A vs B','date':'2026-10-17T18:00Z','competitions':[{'status':{'type':{'state':'post','shortDetail':'Final'}},'competitors':[{'team':{'displayName':'A'},'score':'24','winner':True},{'team':{'displayName':'B'},'score':'17'}]}]}
        out=sports.parse_event(event,'nfl',NOW)
        self.assertEqual(out['state'],'final');self.assertEqual(out['participants'][0]['score'],'24');self.assertTrue(out['participants'][0]['winner'])
    def test_ufc_fight_card_and_winner(self):
        event={'id':'202','name':'UFC Fight Night: Smith vs Jones','date':'2026-10-18T02:00Z',
            'competitions':[{'status':{'type':{'state':'post','shortDetail':'TKO Round 3'}},'competitors':[{'athlete':{'fullName':'Smith'},'winner':True},{'athlete':{'fullName':'Jones'}}]}]}
        out=sports.parse_event(event,'ufc',NOW)
        self.assertEqual(out['state'],'final');self.assertEqual(out['fights'][0]['fighters'][0]['name'],'Smith')
    def test_ancient_fight_rejected(self):
        self.assertIsNone(sports.parse_event({'date':'2025-03-18T03:00Z','id':'old','name':'Old'},'ufc',NOW))
    def test_missing_date_rejected(self):
        self.assertIsNone(sports.parse_event({'name':'Undated'},'nba',NOW))
    def test_invalid_xml_entity_rejected(self):
        self.assertEqual(sports.parse_sports_rss(b'<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>','Test',NOW),[])
    def test_rss_correct_date_not_now(self):
        rss=b'<rss><channel><item><title>UFC main event announced</title><link>https://example.com/story</link><pubDate>Fri, 16 Oct 2026 23:00:00 GMT</pubDate></item></channel></rss>'
        stories=sports.parse_sports_rss(rss,'Publisher',NOW)
        self.assertEqual(stories[0]['date'],'2026-10-16T23:00:00Z');self.assertEqual(stories[0]['league'],'ufc')
    def test_rss_missing_date_rejected(self):
        rss=b'<rss><channel><item><title>Match</title><link>https://example.com/story</link></item></channel></rss>'
        self.assertEqual(sports.parse_sports_rss(rss,'Publisher',NOW),[])
    def test_no_provider_data_does_not_overwrite(self):
        with mock.patch.object(sports,'get_scoreboard',return_value=('nfl',[],'ProviderError')):
            with mock.patch.object(sports,'sportsdb_fallback',return_value=([],0)):
                self.assertIsNone(sports.build(NOW))
    def test_thesportsdb_ufc_fight_card_normalized(self):
        row={'idEvent':'42','strEvent':'UFC: Alpha vs Bravo','dateEvent':'2026-10-18',
             'strTime':'03:00:00','strHomeTeam':'Alpha','strAwayTeam':'Bravo',
             'intHomeScore':None,'intAwayScore':None}
        out=sports.sportsdb_event(row,'ufc',NOW)
        self.assertEqual(out['state'],'upcoming')
        self.assertEqual(out['fights'][0]['fighters'][0]['name'],'Alpha')
    def test_thesportsdb_game_results_only_if_provided(self):
        row={'idEvent':'44','strEvent':'A vs B','strTimestamp':'2026-10-17T08:00:00Z',
             'strHomeTeam':'A','strAwayTeam':'B','intHomeScore':'25','intAwayScore':'16','strStatus':'Final'}
        out=sports.sportsdb_event(row,'nfl',NOW)
        self.assertEqual(out['state'],'final')
        self.assertEqual(out['participants'][0]['score'],'25')
        self.assertTrue(out['participants'][0]['winner'])
    def test_url_safety(self):
        self.assertFalse(sports.safe_url('javascript:alert(1)'))
        self.assertEqual(sports.safe_url('https://www.espn.com/ufc'),'https://www.espn.com/ufc')
if __name__=='__main__':unittest.main()

class InternationalSoccerCoverageTests(unittest.TestCase):
    def test_multiple_countries_and_international_competition(self):
        rows=dict((x[0],x[1]) for x in sports.LEAGUES)
        for slug in ['epl','laliga','bundesliga','seriea','ligue1','ucl','brasileirao','argentina','ligamx','j1','aleague','primeira','mls']:
            self.assertIn(slug,rows)
            self.assertIn(slug,sports.SPORTSDB_LEAGUE_IDS)
        self.assertEqual(len({sports.SPORTSDB_LEAGUE_IDS[x] for x in sports.SPORTSDB_LEAGUE_IDS}),len(sports.SPORTSDB_LEAGUE_IDS))
    def test_international_football_result(self):
        row={'idEvent':'8888','strEvent':'Barcelona vs Real Madrid','strTimestamp':'2026-10-17T21:00:00Z',
             'strHomeTeam':'Barcelona','strAwayTeam':'Real Madrid','strStatus':'Final',
             'intHomeScore':'2','intAwayScore':'1'}
        match=sports.sportsdb_event(row,'laliga',NOW)
        self.assertEqual(match['league'],'laliga')
        self.assertEqual(match['participants'][0]['score'],'2')
    def test_football_rss_is_classified_soccer(self):
        data=b'<rss><channel><item><title>Barcelona prepares for derby</title><link>https://example.com/story</link><pubDate>Fri, 16 Oct 2026 23:00:00 GMT</pubDate></item></channel></rss>'
        self.assertEqual(sports.parse_sports_rss(data,'BBC Football',NOW)[0]['league'],'soccer')
    def test_mma_rss_is_ufc_section(self):
        data=b'<rss><channel><item><title>UFC fight news</title><link>https://example.com/story2</link><pubDate>Fri, 16 Oct 2026 23:00:00 GMT</pubDate></item></channel></rss>'
        self.assertEqual(sports.parse_sports_rss(data,'MMA Fighting',NOW)[0]['league'],'ufc')
