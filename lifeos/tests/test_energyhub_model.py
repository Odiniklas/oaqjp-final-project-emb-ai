import unittest
from energyhub_model import arbitrage_margin_eur,indicative_peak_saving_eur_year,present_value,ScreeningScenario

class FinanceScreeningTest(unittest.TestCase):
    def test_npv_no_discount(self):
        self.assertEqual(present_value(100,[40,40,40],0),20)

    def test_npv_discount(self):
        self.assertAlmostEqual(present_value(100,[110],0.1),0,places=8)

    def test_arbitrage_efficiency_loss(self):
        self.assertAlmostEqual(arbitrage_margin_eur(1000,0.20,0.10,0.8),75)

    def test_peak_units(self):
        self.assertAlmostEqual(indicative_peak_saving_eur_year(100,75),7500)

    def test_reject_bad_efficiency(self):
        with self.assertRaises(ValueError): arbitrage_margin_eur(100,0.2,0.1,0)

    def test_scenario_reproducible(self):
        s=ScreeningScenario(30000,5000,1000,2000,10,0.05).calculate()
        self.assertIn('limitations',s)
        self.assertEqual(s['net_cashflow_eur_year'],4000)
        self.assertGreater(s['npv_eur'],0)

if __name__=='__main__': unittest.main()
