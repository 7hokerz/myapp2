
PK 설정의 중요성 (+ Auto Increment vs UUID ?)


InnoDB 엔진에서는 클러스터링 테이블 형태로 이루어짐.

즉 테이블 자체가 클러스터링 인덱스 모양을 갖추고 있다.

PK는 클러스터링 테이블의 키가 되므로 어떤 컬럼이 PK냐에 따라 테이블의 전체적인 성능이 결정된다.

이러한 클러스터링 테이블은 PK 기반 검색이 빠른 대신 변경 작업(삽입, 수정, 삭제)의 작업은 상대적으로 느림.
(빠른 읽기 / 느린 쓰기)


### PK를 꼭 설정해야 하는가?

여기서, PK를 명시적으로 설정해야 하는 이유?

PK를 명시적으로 설정하지 않으면 InnoDB 엔진은 PK로 대체할 칼럼을 자동으로 선택한다.

적절한 칼럼을 찾지 못하면 내부적으로 칼럼을 생성한 후 PK로 적용하는데 이는 사용자에게 보이지 않고 

쿼리 문장에 명시적으로 사용할 수 없기 때문에 가능하다면 명시적으로 생성하는 것이 좋다.


### PK의 크기

PK의 크기가 커지면 클러스터링 인덱스 또한 커진다는 건 당연한 사실이다.

그리고 InnoDB 엔진에서 세컨더리 인덱스는 리프 노드에 PK 값을 저장한다.

따라서 세컨더리 인덱스의 크기 또한 커진다는 걸 알 수 있다.

인덱스가 커질수록 필요한 메모리 및 저장공간 또한 많아지므로 레코드 건수가 적으면 큰 문제가 없을 수도 있지만

레코드의 수가 많으면 큰 차이가 발생한다.


### PK 변경 작업

일반적으로 PK를 변경하는 작업은 **매우 비싼 작업**이다.

클러스터링 테이블은 PK에 의존하는데, PK에 따라 레코드의 저장 위치가 결정됨.

만약 PK의 값이 바뀐다면 레코드의 저장 위치 또한 변경되어야 한다.

그게 무슨 문제?

PK나 인덱스에 속하지 않는 컬럼은 레코드의 값을 변경해도 위치가 변경되지 않고 값만 바꾸면 되지만 

PK나 인덱스에 속한 값이 변경되면 값 뿐만 아니라 **위치 또한 변경**되는데

다른 노드를 움직이면서 인덱스를 재구성해야 하기 때문이다. 

PK가 AI로 구성되면 AI 값은 바뀔 일이 없으므로 이러한 문제에서 해방된다.


# PK와 외래키

PK


### 새로운 테이블 구조

나는 이전에 PK를 AUTO-INCREMENT로 생성하지 않고 아래와 같이 설정했다.

post_list_prev(
    postNum, (INT) (복합 PK)
    identityCode, (VARCHAR) 
    galleryCODE, (VARCHAR) (복합 PK)
    added_date (TIMESTAMP)
)

PK는 행을 식별하는 식별자이므로 목적에 따라서 위와 같이 설정했었다.

post_list_cur(
    id (INT) (AI) (PK)
    postNum, (INT) (복합 UQ) 
    identityCode, (VARCHAR) 
    galleryCODE, (VARCHAR) (복합 UQ)
    added_date (TIMESTAMP)
)

1. 기존 PK 칼럼 >> UQ 복합 인덱스로 변경
2. PK는 AI로 별도 생성


### 테스트 과정

- 기존 테이블에서 2개의 다른 테이블에 데이터 복사
(PK가 AI인 경우와 아닌 경우)

- 동일한 여러 쿼리에 대해 `EXPLAIN`, `EXPLAIN ANALYZE` 비교

- Express 서버에서 테스트하여 대략적인 속도 측정 및 비교


1. SELECT

```SQL
    EXPLAIN ANALYZE SELECT postNum FROM ${tableName} 
        JOIN fixed_name_list f
        ON f.identityCode = ${tableName}.identityCode
            AND f.galleryCODE = ${tableName}.galleryCODE
        WHERE f.identityCode = ? 
            AND f.galleryCODE = ?
            AND f.is_valid = 0
        ORDER BY postNum ASC
        FOR UPDATE
```

```SQL
-> Covering index lookup on p using ix_uid_gid_post (identityCode='wamdy', galleryCODE='girlsong')  
    (cost=0.467 rows=2) (actual time=0.0098..0.0138 rows=2 loops=1)
```

```SQL
-> Sort: p.postNum  (cost=0.7 rows=2) (actual time=0.0388..0.039 rows=2 loops=1)
    -> Index lookup on p using ix_uid_gid_post (identityCode='wamdy', galleryCODE='girlsong')  
        (cost=0.7 rows=2) (actual time=0.0226..0.0248 rows=2 loops=1)
```

- 복합 PK
인덱스 리프 노드에 있는 레코드에 `postNum` PK가 존재하므로 테이블을 스캔하지 않고 커버링 인덱스

- AI PK
세컨더리 인덱스로 PK를 찾아 테이블에서 최종적으로 `postNum` 을 가져온 후 정렬


`SELECT` 에서는 이전 테이블 구조가 더 효율적임.


2. INSERT

프로시저로 1~1000까지 insert (순차적)

```SQL
    DELIMITER $$ 
    DROP PROCEDURE IF EXISTS myFunction$$
    CREATE PROCEDURE myFunction() -- ⓐ myFunction이라는 이름의 프로시져
    BEGIN
        DECLARE i INT DEFAULT 1; -- ⓑ i변수 선언, defalt값으로 1설정
        WHILE (i <= 1000) DO -- ⓒ for문 작성(i가 1000이 될 때까지 반복)
            INSERT INTO post_list (or post_list_prev) 
            (postNum, identityCode, galleryCODE) 
            VALUE (i, 'wamdy', 'grsgills'); -- ⓓ 테이블에 i값 넣어주기
            SET i = i + 1; -- ⓔ i값에 1더해주고 WHILE문 처음으로 이동
        END WHILE;
    END$$
    DELIMITER ;

    CALL myFunction;
```

차이 없음?


3. UPDATE 

프로시저로 1~1000까지 insert (순차적)

```SQL
    SET profiling = 1;

    UPDATE post_list (or post_list_prev)
    SET postNum = postNum + 1000
    WHERE identityCode = 'wamdy'
    AND galleryCODE = 'grsgills';

    SHOW PROFILES;

    SET profiling = 0;
```

결과(Query 2: 복합 PK, Query 4: AI PK)

복합 PK보다 **AI PK**에서 더욱 빠른 속도를 보임. (약 2배)



4. DELETE

프로시저로 1~1000까지 insert (순차적)

```SQL
    SET profiling = 1;

    DELETE FROM post_list (or post_list_prev)
    WHERE identityCode = 'wamdy' 
    AND galleryCODE = 'grsgills';

    SHOW PROFILES;

    SET profiling = 0;
```

결과(Query 2: 복합 PK, Query 4: AI PK)

두 PK 구조에서 큰 차이를 확인할 수 없었음.?? 다른 상황에서도 테스트 필요
```SQL
DELIMITER $$ 
DROP PROCEDURE IF EXISTS myFunction$$
CREATE PROCEDURE myFunction() -- ⓐ myFunction이라는 이름의 프로시져
BEGIN
    DECLARE i INT DEFAULT 1; -- ⓑ i변수 선언, defalt값으로 1설정
    DECLARE v INT DEFAULT 1;
    DECLARE startTime DATETIME(6); -- (6)은 마이크로초 단위까지 정밀도 지정
    DECLARE endTime DATETIME(6);
    SET startTime = NOW(6); -- 프로시저 시작 시간 기록
    WHILE (i <= 1000) DO -- ⓒ for문 작성(i가 1000이 될 때까지 반복)
		SET v = v + FLOOR(1 + RAND() * 5);
        INSERT INTO post_list_prev (postNum, identityCode, galleryCODE) VALUE (v, 'wamdy', 'grsgills'); -- ⓓ 테이블에 i값 넣어주기
        SET i = i + 1; -- ⓔ i값에 1더해주고 WHILE문 처음으로 이동
    END WHILE;
    SET endTime = NOW(6); -- 프로시저 종료 시간 기록
    SELECT
        startTime AS ProcedureStartTime,
        endTime AS ProcedureEndTime,
        TIMEDIFF(endTime, startTime) AS TotalDuration;
END$$
DELIMITER ;

CALL myFunction;
```
