library(tidyverse)
library(zoo)
Library(lubridate)

#Load nominal expenditures (Current Prices)
df_current <- read.csv("3610012401_databaseLoadingData-2.csv") %>%
filter(GEO == "Canada") %>%
select(REF_DATE, Prices, Estimates, VALUE_current = VALUE)

# Load real volumes (Constant Prices)
df_constant <- read.csv("3610012401_databaseLoadingData.csv") %>%
filter(GEO == "Canada") %>%
select(REF_DATE, Prices, Estimates, VALUE_constant = VALUE)

# Merge the two tables
df_merged <- df_current %>%
inner_join(df_constant, by = c("REF_DATE", "Estimates")) %>%
mutate(date = as.yearqtr(ymd(paste0(REF_DATE, "-01")))) %>%
select( date, category = Estimates,val_current = VALUE_current, val_constant = VALUE_constant)

# Calculate price index
df_prices <- df_merged %>%
mutate(p_index = (val_current / val_constant) * 100)

# Calculate Quarterly Inflation
df_inflation <- df_prices %>%
arrange(category, date) %>%
group_by(category) %>%
mutate(p_quarter = (log(p_index) - log(lag(p_index)))*100) %>%
ungroup()

# Calculate Expenditure Weights
df_weights <- df_inflation %>%
group_by(date) %>%
mutate(total_exp = val_current[category == "Household final consumption expenditure"]) %>%
ungroup() %>%
filter( category != "Household final consumption expenditure", category != "Net expenditure abroad") %>%
mutate(weight = val_current / total_exp)

