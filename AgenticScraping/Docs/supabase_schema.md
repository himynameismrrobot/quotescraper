#Schema as of 2024-11-23

| table_name              | column_name               | data_type                | is_nullable | column_default               |
| ----------------------- | ------------------------- | ------------------------ | ----------- | ---------------------------- |
| accounts                | id                        | uuid                     | NO          | gen_random_uuid()            |
| accounts                | user_id                   | uuid                     | NO          |                              |
| accounts                | type                      | text                     | NO          |                              |
| accounts                | provider                  | text                     | NO          |                              |
| accounts                | provider_account_id       | text                     | NO          |                              |
| accounts                | refresh_token             | text                     | YES         |                              |
| accounts                | access_token              | text                     | YES         |                              |
| accounts                | expires_at                | bigint                   | YES         |                              |
| accounts                | token_type                | text                     | YES         |                              |
| accounts                | scope                     | text                     | YES         |                              |
| accounts                | id_token                  | text                     | YES         |                              |
| accounts                | session_state             | text                     | YES         |                              |
| accounts                | created_at                | timestamp with time zone | YES         | now()                        |
| accounts                | updated_at                | timestamp with time zone | YES         | now()                        |
| agent_config            | id                        | uuid                     | NO          | gen_random_uuid()            |
| agent_config            | created_at                | timestamp with time zone | NO          | timezone('utc'::text, now()) |
| agent_config            | updated_at                | timestamp with time zone | NO          | timezone('utc'::text, now()) |
| agent_config            | auto_run_enabled          | boolean                  | NO          | false                        |
| agent_config            | run_frequency_hours       | integer                  | NO          | 24                           |
| agent_config            | last_run_time             | timestamp with time zone | YES         |                              |
| agent_config            | similarity_threshold      | double precision         | NO          | 0.85                         |
| agent_config            | max_parallel_extractions  | integer                  | NO          | 3                            |
| agent_logs              | id                        | uuid                     | NO          | gen_random_uuid()            |
| agent_logs              | created_at                | timestamp with time zone | NO          | timezone('utc'::text, now()) |
| agent_logs              | run_id                    | uuid                     | YES         |                              |
| agent_logs              | node_name                 | text                     | NO          |                              |
| agent_logs              | message                   | text                     | NO          |                              |
| agent_logs              | level                     | text                     | NO          | 'info'::text                 |
| agent_logs              | metadata                  | jsonb                    | YES         |                              |
| agent_runs              | id                        | uuid                     | NO          | gen_random_uuid()            |
| agent_runs              | created_at                | timestamp with time zone | NO          | timezone('utc'::text, now()) |
| agent_runs              | updated_at                | timestamp with time zone | NO          | timezone('utc'::text, now()) |
| agent_runs              | status                    | text                     | NO          | 'running'::text              |
| agent_runs              | thread_id                 | text                     | NO          |                              |
| agent_runs              | started_at                | timestamp with time zone | NO          |                              |
| agent_runs              | completed_at              | timestamp with time zone | YES         |                              |
| agent_runs              | error_message             | text                     | YES         |                              |
| agent_runs              | total_articles_found      | integer                  | YES         | 0                            |
| agent_runs              | articles_processed        | integer                  | YES         | 0                            |
| agent_runs              | quotes_extracted          | integer                  | YES         | 0                            |
| agent_runs              | quotes_validated          | integer                  | YES         | 0                            |
| agent_runs              | quotes_stored             | integer                  | YES         | 0                            |
| articles                | id                        | uuid                     | NO          | gen_random_uuid()            |
| articles                | parent_url                | text                     | NO          |                              |
| articles                | article_url               | text                     | NO          |                              |
| articles                | article_date              | timestamp with time zone | NO          |                              |
| articles                | headline                  | text                     | YES         |                              |
| articles                | article_text              | text                     | YES         |                              |
| articles                | total_quotes              | integer                  | YES         | 0                            |
| articles                | created_at                | timestamp with time zone | YES         | now()                        |
| articles                | updated_at                | timestamp with time zone | YES         | now()                        |
| comment_reactions       | id                        | uuid                     | NO          | gen_random_uuid()            |
| comment_reactions       | emoji                     | text                     | NO          |                              |
| comment_reactions       | comment_id                | uuid                     | NO          |                              |
| comment_reactions       | created_at                | timestamp with time zone | YES         | now()                        |
| comment_reactions       | updated_at                | timestamp with time zone | YES         | now()                        |
| comment_reactions_users | comment_reaction_id       | uuid                     | NO          |                              |
| comment_reactions_users | user_id                   | uuid                     | NO          |                              |
| comments                | id                        | uuid                     | NO          | gen_random_uuid()            |
| comments                | text                      | text                     | NO          |                              |
| comments                | quote_id                  | uuid                     | NO          |                              |
| comments                | user_id                   | uuid                     | NO          |                              |
| comments                | created_at                | timestamp with time zone | YES         | now()                        |
| following               | id                        | uuid                     | NO          | gen_random_uuid()            |
| following               | user_id                   | uuid                     | NO          |                              |
| following               | speaker_id                | uuid                     | YES         |                              |
| following               | org_id                    | uuid                     | YES         |                              |
| following               | created_at                | timestamp with time zone | YES         | now()                        |
| monitored_urls          | id                        | uuid                     | NO          | gen_random_uuid()            |
| monitored_urls          | url                       | text                     | NO          |                              |
| monitored_urls          | logo_url                  | text                     | YES         |                              |
| monitored_urls          | last_crawled_at           | timestamp with time zone | YES         |                              |
| monitored_urls          | created_at                | timestamp with time zone | YES         | now()                        |
| monitored_urls          | updated_at                | timestamp with time zone | YES         | now()                        |
| organizations           | id                        | uuid                     | NO          | gen_random_uuid()            |
| organizations           | name                      | text                     | NO          |                              |
| organizations           | logo_url                  | text                     | YES         |                              |
| organizations           | created_at                | timestamp with time zone | YES         | now()                        |
| organizations           | updated_at                | timestamp with time zone | YES         | now()                        |
| quote_reactions         | id                        | uuid                     | NO          | gen_random_uuid()            |
| quote_reactions         | emoji                     | text                     | NO          |                              |
| quote_reactions         | quote_id                  | uuid                     | NO          |                              |
| quote_reactions         | created_at                | timestamp with time zone | YES         | now()                        |
| quote_reactions         | updated_at                | timestamp with time zone | YES         | now()                        |
| quote_reactions_users   | quote_reaction_id         | uuid                     | NO          |                              |
| quote_reactions_users   | user_id                   | uuid                     | NO          |                              |
| quote_staging           | id                        | uuid                     | NO          | gen_random_uuid()            |
| quote_staging           | summary                   | text                     | NO          |                              |
| quote_staging           | raw_quote_text            | text                     | NO          |                              |
| quote_staging           | speaker_name              | text                     | NO          |                              |
| quote_staging           | article_date              | timestamp with time zone | NO          |                              |
| quote_staging           | article_url               | text                     | NO          |                              |
| quote_staging           | article_headline          | text                     | YES         |                              |
| quote_staging           | parent_monitored_url      | text                     | NO          |                              |
| quote_staging           | created_at                | timestamp with time zone | YES         | now()                        |
| quote_staging           | updated_at                | timestamp with time zone | YES         | now()                        |
| quote_staging           | content_vector            | USER-DEFINED             | YES         |                              |
| quote_staging           | summary_vector            | USER-DEFINED             | YES         |                              |
| quote_staging           | similar_to_quote_id       | uuid                     | YES         |                              |
| quote_staging           | similarity_score          | double precision         | YES         |                              |
| quotes                  | id                        | uuid                     | NO          | gen_random_uuid()            |
| quotes                  | summary                   | text                     | NO          |                              |
| quotes                  | raw_quote_text            | text                     | NO          |                              |
| quotes                  | article_date              | timestamp with time zone | NO          |                              |
| quotes                  | article_url               | text                     | NO          |                              |
| quotes                  | article_headline          | text                     | YES         |                              |
| quotes                  | speaker_id                | uuid                     | NO          |                              |
| quotes                  | parent_monitored_url      | text                     | NO          |                              |
| quotes                  | parent_monitored_url_logo | text                     | YES         |                              |
| quotes                  | created_at                | timestamp with time zone | YES         | now()                        |
| quotes                  | updated_at                | timestamp with time zone | YES         | now()                        |
| quotes                  | content_vector            | USER-DEFINED             | YES         |                              |
| quotes                  | summary_vector            | USER-DEFINED             | YES         |                              |
| quotes                  | similar_to_quote_id       | uuid                     | YES         |                              |
| quotes                  | similarity_score          | double precision         | YES         |                              |
| sessions                | id                        | uuid                     | NO          | gen_random_uuid()            |
| sessions                | session_token             | text                     | NO          |                              |
| sessions                | user_id                   | uuid                     | NO          |                              |
| sessions                | expires                   | timestamp with time zone | NO          |                              |
| sessions                | created_at                | timestamp with time zone | YES         | now()                        |
| sessions                | updated_at                | timestamp with time zone | YES         | now()                        |
| speakers                | id                        | uuid                     | NO          | gen_random_uuid()            |
| speakers                | name                      | text                     | NO          |                              |
| speakers                | image_url                 | text                     | YES         |                              |
| speakers                | organization_id           | uuid                     | YES         |                              |
| speakers                | created_at                | timestamp with time zone | YES         | now()                        |
| speakers                | updated_at                | timestamp with time zone | YES         | now()                        |
| staged_articles         | id                        | uuid                     | NO          | gen_random_uuid()            |
| staged_articles         | created_at                | timestamp with time zone | NO          | timezone('utc'::text, now()) |
| staged_articles         | url                       | text                     | NO          |                              |
| staged_articles         | headline                  | text                     | YES         |                              |
| staged_articles         | parent_url                | text                     | NO          |                              |
| staged_articles         | article_date              | timestamp with time zone | YES         |                              |
| staged_articles         | discovered_at             | timestamp with time zone | NO          |                              |
| staged_articles         | processed                 | boolean                  | YES         | false                        |
| staged_articles         | processed_at              | timestamp with time zone | YES         |                              |
| users                   | id                        | uuid                     | NO          | gen_random_uuid()            |
| users                   | name                      | text                     | YES         |                              |
| users                   | username                  | text                     | YES         |                              |
| users                   | email                     | text                     | YES         |                              |
| users                   | email_verified            | timestamp with time zone | YES         |                              |
| users                   | image                     | text                     | YES         |                              |
| users                   | created_at                | timestamp with time zone | YES         | now()                        |
| users                   | updated_at                | timestamp with time zone | YES         | now()                        |
| users                   | is_admin                  | boolean                  | YES         | false                        |