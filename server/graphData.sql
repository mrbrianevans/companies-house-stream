-- using where statements
SELECT filing.minute as minute, company.count as company, filing.count as filing
FROM (select date_trunc('minute', f.published) as minute, count(f.published) as count
      from filing_events f
      group by date_trunc('minute', f.published)
      order by date_trunc('minute', f.published) desc
      limit 10) as filing
        ,
     (select date_trunc('minute', c.published) as minute, count(c.published) as count
      from company_events c
      group by date_trunc('minute', c.published)
      order by date_trunc('minute', c.published) desc
      limit 10) AS company
where filing.minute = company.minute
ORDER BY filing.minute
;

-- using joins
SELECT company.minute as minute, company.count as company, filing.count as filing
FROM (select date_trunc('minute', f.published) as minute, count(f.published) as count
      from filing_events f
      group by date_trunc('minute', f.published)
      order by date_trunc('minute', f.published) desc
      limit 10) as filing
         INNER JOIN
     (select date_trunc('minute', c.published) as minute, count(c.published) as count
      from company_events c
      group by date_trunc('minute', c.published)
      order by date_trunc('minute', c.published) desc
      limit 10) AS company
     ON filing.minute = company.minute
ORDER BY company.minute
;


-- test bench
SELECT COUNT(minute)  as total,
       COUNT(company) as count_company,
       COUNT(filing)  as count_filing,
       MAX(company)   as max_company,
       MAX(filing)    as max_filing,
       AVG(company)   as avg_compay,
       AVG(filing)    as avg_filing
FROM (
-- insert query here

         SELECT filing.minute as minute, company.count as company, filing.count as filing
         FROM (select date_trunc('minute', f.published) as minute, count(f.published) as count
               from filing_events f
               group by date_trunc('minute', f.published)
               order by date_trunc('minute', f.published) desc
               limit 100000) as filing FULL OUTER JOIN
(select date_trunc('minute' , c.published) as minute, count(c.published) as count from company_events c group by date_trunc('minute' , c.published) order by date_trunc('minute' , c.published) desc limit 100000) AS company
         ON filing.minute=company.minute
         ORDER BY filing.minute

-- end of query
     ) as res;
