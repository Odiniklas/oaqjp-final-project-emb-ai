"""Illustrative financial screening for energy-hub hypotheses.

No grid dispatch, no binding tariff calculation, no regulatory compliance judgement.
All cashflows EUR, revenues per year EUR/year, energy kWh, power kW.
"""
from dataclasses import dataclass
from math import isfinite


def present_value(initial_investment_eur: float, annual_net_cashflows_eur: list[float],
                  annual_discount_rate: float, terminal_value_eur: float = 0.0) -> float:
    """NPV: -I0 + sum(CFt/(1+r)^t) + terminal/(1+r)^n."""
    values = [initial_investment_eur, annual_discount_rate, terminal_value_eur, *annual_net_cashflows_eur]
    if not all(isfinite(float(x)) for x in values):
        raise ValueError('Alle Werte müssen endlich sein')
    if initial_investment_eur < 0 or annual_discount_rate <= -1:
        raise ValueError('Ungültige Investition oder Diskontierung')
    years = len(annual_net_cashflows_eur)
    return (-initial_investment_eur +
            sum(cf/(1+annual_discount_rate)**year for year,cf in enumerate(annual_net_cashflows_eur,1))+
            terminal_value_eur/(1+annual_discount_rate)**years)


def arbitrage_margin_eur(discharge_kwh: float, sell_price_eur_per_kwh: float,
                         charge_price_eur_per_kwh: float, roundtrip_efficiency: float) -> float:
    """Simplified electricity arbitrage. Excludes fees, ageing and dispatch constraints."""
    values=[discharge_kwh,sell_price_eur_per_kwh,charge_price_eur_per_kwh,roundtrip_efficiency]
    if not all(isfinite(float(x)) for x in values):
        raise ValueError('Werte müssen endlich sein')
    if discharge_kwh<0 or not (0<roundtrip_efficiency<=1):
        raise ValueError('Energie >= 0 und 0 < Wirkungsgrad <= 1 erforderlich')
    return discharge_kwh * (sell_price_eur_per_kwh - charge_price_eur_per_kwh/roundtrip_efficiency)


def indicative_peak_saving_eur_year(peak_reduction_kw: float, charge_eur_kw_year: float) -> float:
    """Illustrative peak-charge multiplication; real network tariffs can differ significantly."""
    if not all(isfinite(float(x)) for x in (peak_reduction_kw,charge_eur_kw_year)):
        raise ValueError('Werte müssen endlich sein')
    if peak_reduction_kw<0 or charge_eur_kw_year<0:
        raise ValueError('Werte dürfen nicht negativ sein')
    return peak_reduction_kw*charge_eur_kw_year


@dataclass(frozen=True)
class ScreeningScenario:
    investment_eur: float
    annual_peak_saving_eur: float
    annual_arbitrage_margin_eur: float
    annual_fixed_opex_eur: float
    years: int
    discount_rate: float

    def calculate(self) -> dict:
        if self.years < 1 or self.years>50:
            raise ValueError('years: 1..50')
        if any(x<0 for x in (self.investment_eur,self.annual_peak_saving_eur,self.annual_fixed_opex_eur)):
            raise ValueError('Investition, Peak-Saving und OPEX müssen >=0 sein')
        annual=self.annual_peak_saving_eur+self.annual_arbitrage_margin_eur-self.annual_fixed_opex_eur
        npv=present_value(self.investment_eur,[annual]*self.years,self.discount_rate)
        return {'net_cashflow_eur_year':round(annual,2),'npv_eur':round(npv,2),
                'limitations': 'Nur illustratives Screening; keine stundenscharfe Dispatch-Simulation. '
                               'Peak-Shaving und Arbitrage können konkurrieren. '
                               'Keine Batteriealterung, Netzentgelttarifierung, Steuern, Finanzierung oder Gebühren.'}
