local_path = 'C:/Users/mmbaoh/fraud-detection-ouest-afrique'
base_monthly = 450.0  # EUR
replaces_salary = 1580.0  # EUR/mois salarié équivalent
dev_cost = 4200.0  # EUR forfait projet
developer_daily = 650.0
days_per_week = 5
weeks = 16

direct_cost = base_monthly + dev_cost
annual_cost = base_monthly * 12
opportunity_12m = replaces_salary * 12
savings_12m = opportunity_12m - annual_cost
roi_12m = (savings_12m / (annual_cost if annual_cost else 1)) * 100

manual_hours_per_month = 120
hourly_wage = 22.0
manual_cost_12m = manual_hours_per_month * hourly_wage * 12
monthly_savings_vs_manual = manual_hours_per_month * hourly_wage - base_monthly
savings_vs_manual_12m = monthly_savings_vs_manual * 12
roi_vs_manual = (savings_vs_manual_12m / (base_monthly * 12 if base_monthly * 12 else 1)) * 100

print(f'project={local_path}')
print(f'base_monthly_EUR={base_monthly}')
print(f'dev_cost_EUR={dev_cost}')
print(f'direct_cost_EUR={direct_cost}')
print(f'annual_cost_EUR={annual_cost}')
print(f'opportunity_12m_EUR={opportunity_12m}')
print(f'savings_12m_EUR={savings_12m}')
print(f'roi_12m_percent={roi_12m}')
print(f'manual_cost_12m_EUR={manual_cost_12m}')
print(f'savings_vs_manual_12m_EUR={savings_vs_manual_12m}')
print(f'roi_vs_manual_percent={roi_vs_manual}')
