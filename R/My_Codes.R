library(tidyverse)
library(zoo)
df_current <- read.csv("3610012401_databaseLoadingData-2.csv") %>%
filter(GEO == "Canada") %>%
select(REF_DATE, Prices, Estimates, VALUE_current = VALUE)
