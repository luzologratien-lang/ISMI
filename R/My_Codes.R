library(tidyverse)
library(zoo)

# ---------------------------------------------------------------------------
# load raw statcan data (current + constant prices) from table 36-10-0124-01
# ---------------------------------------------------------------------------

current  <- read_csv("3610012401_databaseLoadingData-2.csv")
constant <- read_csv("3610012401_databaseLoadingData.csv")

current %>% distinct(Prices)
constant %>% distinct(Prices)

# the 114 categories in the raw export are not flat, they're a hierarchy (e.g. "Housing" contains "Electricity", "Rent" etc as
# sub-items). weights sum to ~ 198% if I just use them all as-is, so I need to pull the parent/child structure and keep only the
# most detailed (leaf) categories


# ----------------------------------------------------------
# Download and parse the category hierarchy (cube metadata)
# ----------------------------------------------------------

# StatCan's category tree (parent/child structure) isn't in the main export, it has to be pulled separately from the cube metadata file.

url <- "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadCubeMetaData-nonTraduit.action?pid=3610012401&csvLocale=en"
download.file(url, destfile = "hierarchy_metadata.csv")

lines <- readLines("hierarchy_metadata.csv", encoding = "UTF-8")
start <- grep('"Dimension ID","Member Name"', lines) + 1
end   <- grep("Symbol Legend", lines)[1] - 2
member_lines <- lines[start:end]

hierarchy_raw <- read.csv(text = paste(member_lines, collapse = "\n"),
header = FALSE, stringsAsFactors = FALSE)
colnames(hierarchy_raw) <- c("Dimension_ID", "Member_Name", "Classification_Code",
"Member_ID", "Parent_Member_ID", "Terminated", "Member_Notes", "Member_Definitions")

# dimension 4 = "Estimates" -> that's the actual category list
estimates <- hierarchy_raw %>%
filter(Dimension_ID == 4) %>%
mutate(Member_ID = as.integer(Member_ID),
Parent_Member_ID = as.integer(Parent_Member_ID)) %>%
select(Member_ID, Member_Name, Parent_Member_ID)

# leaf = never shows up as someone else's parent
leaf_ids <- estimates %>%
filter(!Member_ID %in% Parent_Member_ID) %>%
pull(Member_ID)

# drop the "adjusting entry" ones, those are just accounting balance items, not real spending categories
real_leaves <- estimates %>%
filter(Member_ID %in% leaf_ids, !str_detect(Member_Name, "adjusting entry")) %>%
pull(Member_ID)

# -> 132 total, 116 leaves, 101 real leaves. this is the number I keep.

# quick sanity check: do the 101 leaves actually add up to the official total every quarter? they should, if the hierarchy is right

current_leaves <- current %>%
  mutate(Member_ID = as.integer(str_extract(COORDINATE, "[0-9]+$"))) %>%
  filter(Member_ID %in% real_leaves) %>%
  select(REF_DATE, Member_ID, VALUE)

total_officiel <- current %>%
  mutate(Member_ID = as.integer(str_extract(COORDINATE, "[0-9]+$"))) %>%
  filter(Member_ID == 1) %>%
  select(REF_DATE, VALUE) %>%
  rename(total = VALUE)

# na.rm=TRUE because the two cannabis categories didn't exist before legalization. Those are real zeros, not missing data

verification <- current_leaves %>%
  group_by(REF_DATE) %>%
  summarise(somme_feuilles = sum(VALUE, na.rm = TRUE)) %>%
  left_join(total_officiel, by = "REF_DATE") %>%
  mutate(ecart = total - somme_feuilles)

summary(verification$ecart)   # should be all zeros

# -------------------------
# build the clean dataset
# -------------------------

constant_leaves <- constant %>%
  mutate(Member_ID = as.integer(str_extract(COORDINATE, "[0-9]+$"))) %>%
  filter(Member_ID %in% real_leaves) %>%
  select(REF_DATE, Member_ID, VALUE) %>%
  rename(constant_price = VALUE)

df_final <- current_leaves %>%
  rename(current_price = VALUE) %>%
  mutate(current_price = replace_na(current_price, 0)) %>%
  left_join(constant_leaves %>% mutate(constant_price = replace_na(constant_price, 0)),
  by = c("REF_DATE", "Member_ID")) %>%
  left_join(estimates %>% select(Member_ID, Member_Name), by = "Member_ID") %>%
  rename(category = Member_Name) %>%
  mutate(date = as.yearqtr(paste0(substr(REF_DATE, 1, 4), "-",
  as.integer(substr(REF_DATE, 6, 7)) %/% 3 + 1), format = "%Y-%q")) %>%
  arrange(category, date)

# price index, weights, inflation rate
df_final <- df_final %>%
  group_by(date) %>%
  mutate(total_spending = sum(current_price)) %>%
  ungroup() %>%
  mutate(price_index = current_price / constant_price * 100,
  category_weight = current_price / total_spending ) %>%
  arrange(category, date) %>%
  group_by(category) %>%
  mutate(inflation_rate = log(price_index) - log(lag(price_index))) %>%
  ungroup()

# weights should sum to 1 every quarter, and the only NaN price indexes should be the two cannabis categories (0/0 before they existed)

df_final %>% group_by(date) %>% summarise(s = sum(category_weight)) %>% pull(s) %>% summary()
df_final %>% filter(is.nan(price_index)) %>% count(category)

# -----------------------------------------------
# rolling AR(1) trend model -> inflation shocks
# -----------------------------------------------

# for each category, I fit inflation on its own lag using a 10yr (40 quarter) rolling window, then compare the actual value to
# what that model would've predicted. the gap is the "shock"

compute_shocks_one_category <- function(inflation_vec, window = 40) {
  n <- length(inflation_vec)
  shocks <- rep(NA_real_, n)

  for (t in (window + 2):n) {
  y <- inflation_vec[(t - window):(t - 1)]
  x <- inflation_vec[(t - window - 1):(t - 2)]

  valid <- !is.na(y) & !is.na(x)
  if (sum(valid) < window * 0.8) next

  fit <- lm(y[valid] ~ x[valid])
  alpha <- coef(fit)[1]
  rho   <- coef(fit)[2]

  if (is.na(inflation_vec[t]) || is.na(inflation_vec[t - 1])) next

  pred <- alpha + rho * inflation_vec[t - 1]
  shocks[t] <- inflation_vec[t] - pred }
shocks }

df_final <- df_final %>% arrange(category, date)

df_shocks <- df_final %>%
  group_by(category) %>%
  mutate(shock = compute_shocks_one_category(inflation_rate)) %>%
  ungroup()

# first valid shock should be around 1991 Q2 (1981 Q1 + 40 quarters)
df_shocks %>% filter(!is.na(shock)) %>% summarise(min(date), max(date))

# ------------------------------------------------
# momentum flags : 3 consecutive same-sign shocks
# ------------------------------------------------

df_shocks <- df_shocks %>%
arrange(category, date) %>%
group_by(category) %>%
mutate( sign_shock = sign(shock),
positive_momentum = sign_shock == 1  & lag(sign_shock, 1) == 1  & lag(sign_shock, 2) == 1,
negative_momentum = sign_shock == -1 & lag(sign_shock, 1) == -1 & lag(sign_shock, 2) == -1
) %>%
ungroup() %>%
mutate(
positive_momentum = replace_na(positive_momentum, FALSE),
negative_momentum = replace_na(negative_momentum, FALSE))

# sanity check - shouldn't be 0% or 90%
df_shocks %>%
filter(!is.na(shock)) %>%
summarise(part_positive = mean(positive_momentum),
part_negative = mean(negative_momentum))

# ---------------------------------------------------------------------
# final index : weighted positive share minus weighted negative share
# ---------------------------------------------------------------------

df_ismi <- df_shocks %>%
filter(!is.na(shock)) %>%
group_by(date) %>%
summarise(
positive_share = sum(category_weight * positive_momentum),
negative_share = sum(category_weight * negative_momentum),
ISMI = positive_share - negative_share) %>%
arrange(date)

# first two quarters (1991 Q2, Q3) come out as 0. Not enough history yet to confirm a 3-quarter run, not a real "no momentum" reading.
# real series effectively starts 1991 Q4

summary(df_ismi$ISMI)
df_ismi %>% filter(date >= as.yearqtr("2020 Q1"), date <= as.yearqtr("2022 Q4"))

# --------
# charts
# --------

# full series
ggplot(df_ismi, aes(x = as.Date(date), y = ISMI)) +
  geom_hline(yintercept = 0, color = "grey50", linewidth = 0.4) +
  geom_line(color = "#1f4e79", linewidth = 0.6) +
  labs(
    title = "Inflation Shock Momentum Index (ISMI) — Canada",
    subtitle = "1991 Q2 - 2026 Q1, disaggregated HFCE categories\n(StatCan, table 36-10-0124-01)",
    x = NULL,
    y = "ISMI (positive share minus negative share)"
  ) +
  scale_x_date(date_breaks = "5 years", date_labels = "%Y") +
  theme_minimal(base_size = 12) +
  theme(
    panel.grid.minor = element_blank(),
    plot.title = element_text(face = "bold"),
    plot.subtitle = element_text(size = 9, color = "grey30")
  )

# positive vs negative decomposition, not stack, so we can see each share's own height
df_ismi %>%
  pivot_longer(cols = c(positive_share, negative_share),
               names_to = "type", values_to = "share") %>%
  mutate(type = recode(type,
                        positive_share = "Positive momentum",
                        negative_share = "Negative momentum")) %>%
  ggplot(aes(x = as.Date(date), y = share, fill = type)) +
  geom_area(position = "identity", alpha = 0.6) +
  geom_hline(yintercept = 0, color = "grey40", linewidth = 0.3) +
  scale_fill_manual(values = c("Positive momentum" = "#c0392b",
                                "Negative momentum" = "#2874a6")) +
  labs(
    title = "ISMI — Positive vs negative share decomposition",
    subtitle = "Expenditure-weighted share of the basket in positive vs negative momentum, by quarter",
    x = NULL, y = "Weighted basket share", fill = NULL
  ) +
  scale_x_date(date_breaks = "5 years", date_labels = "%Y") +
  theme_minimal(base_size = 12) +
  theme(
    panel.grid.minor = element_blank(),
    plot.title = element_text(face = "bold"),
    plot.subtitle = element_text(size = 9, color = "grey30"),
    legend.position = "top"
  )

# ISMI vs actual aggregate inflation
df_aggregate <- df_final %>%
  group_by(date) %>%
  summarise(
    total_current  = sum(current_price),
    total_constant = sum(constant_price)
  ) %>%
  mutate(
    aggregate_price_index = total_current / total_constant * 100,
    aggregate_inflation = log(aggregate_price_index) - log(lag(aggregate_price_index))
  ) %>%
  select(date, aggregate_inflation)

df_compare <- df_ismi %>%
  left_join(df_aggregate, by = "date")

scale_factor <- 15   # just for readability on the secondary axis

ggplot(df_compare, aes(x = as.Date(date))) +
  geom_hline(yintercept = 0, color = "grey50", linewidth = 0.3) +
  geom_line(aes(y = ISMI, color = "ISMI"), linewidth = 0.6) +
  geom_line(aes(y = aggregate_inflation * scale_factor, color = "Aggregate inflation"),
            linewidth = 0.6) +
  scale_y_continuous(
    name = "ISMI",
    sec.axis = sec_axis(~ . / scale_factor, name = "Aggregate inflation (q/q)")
  ) +
  scale_color_manual(values = c("ISMI" = "#1f4e79", "Aggregate inflation" = "#c0392b")) +
  labs(title = "ISMI vs observed aggregate inflation — Canada",
       subtitle = "Informal visual check ahead of the formal predictive-power test",
       x = NULL, color = NULL) +
  scale_x_date(date_breaks = "5 years", date_labels = "%Y") +
  theme_minimal(base_size = 12) +
  theme(legend.position = "top",
        plot.title = element_text(face = "bold"),
        plot.subtitle = element_text(size = 9, color = "grey30"))

# next: test if ISMI actually predicts future inflation (t+4, t+8,
# t+12 quarters), like Lansing & Shapiro do for the US
