# C4 Skeletons — Quick-Start Templates

Ready-to-copy mermaid templates for every C4 diagram type, with placeholder names you can swap in for your real ones. Conventions follow `references/c4-and-diagrams.md`.

Every skeleton also has a **flowchart fallback** at the bottom of the file — for environments where mermaid's experimental C4 renderer misbehaves.

Element-id naming convention used throughout: short lowercase tokens (`api`, `db`, `worker`), all unique within one diagram. Display names go in the quoted strings.

---

## Level 1 — System Context

```mermaid
C4Context
    title System Context — <System Name>

    Person(user, "<User Role>", "<What they do>")
    Person(adminuser, "<Admin Role>", "<What they do>")

    System(sys, "<System Name>", "<One-line purpose>")

    System_Ext(ext1, "<External System 1>", "<Role from this system's POV>")
    System_Ext(ext2, "<External System 2>", "<Role from this system's POV>")

    Rel(user, sys, "<verb phrase>", "HTTPS")
    Rel(adminuser, sys, "<verb phrase>", "HTTPS")
    Rel(sys, ext1, "<verb phrase>", "HTTPS / REST")
    Rel(sys, ext2, "<verb phrase>", "HTTPS / Webhook")
```

---

## Level 1 — System Landscape (multi-system / solution architecture)

```mermaid
C4Context
    title System Landscape — <Domain or Org>

    Person(customer, "<Customer role>", "<...>")
    Person(internaluser, "<Internal role>", "<...>")

    Enterprise_Boundary(org, "<Org / Business Unit>") {
        System(sysa, "<System A>", "<purpose>")
        System(sysb, "<System B>", "<purpose>")
        System(sysc, "<System C>", "<purpose>")
        System(idp, "<Identity Provider>", "<purpose>")
    }

    System_Ext(extpartner, "<External Partner System>", "<role>")
    System_Ext(extvendor, "<External Vendor>", "<role>")

    Rel(customer, sysa, "<verb>", "HTTPS")
    Rel(internaluser, sysb, "<verb>", "HTTPS")
    Rel(sysa, sysb, "<verb>", "HTTPS / REST")
    Rel(sysa, idp, "Authenticates", "OIDC")
    Rel(sysb, sysc, "<verb>", "HTTPS / REST")
    Rel(sysb, extpartner, "<verb>", "HTTPS / REST")
    Rel(sysa, extvendor, "<verb>", "HTTPS / REST")
```

---

## Level 2 — Container

```mermaid
C4Container
    title Container Diagram — <System Name>

    Person(user, "<User Role>", "<...>")

    System_Boundary(sys, "<System Name>") {
        Container(web, "Web SPA", "TypeScript, React", "<browser-facing UI>")
        Container(mobile, "Mobile App", "Swift / Kotlin", "<iOS and Android client>")
        Container(api, "<API name>", "<language, framework>", "<purpose>")
        Container(worker, "<Worker name>", "<language>", "<async work>")
        ContainerDb(db, "<Primary store>", "PostgreSQL 16", "<what it stores>")
        ContainerDb(cache, "Read Cache", "Redis 7", "<what's cached>")
        ContainerQueue(bus, "Event Bus", "<broker>", "<events carried>")
    }

    System_Ext(ext1, "<External System>", "<role>")
    System_Ext(ext2, "<External Notifier>", "<role>")

    Rel(user, web, "Uses", "HTTPS")
    Rel(user, mobile, "Uses", "HTTPS")
    Rel(web, api, "Calls", "HTTPS / JSON")
    Rel(mobile, api, "Calls", "HTTPS / JSON")
    Rel(api, db, "Reads/writes", "SQL/TCP")
    Rel(api, cache, "Reads/writes", "RESP")
    Rel(api, bus, "Publishes events", "<protocol>")
    Rel(worker, bus, "Consumes events", "<protocol>")
    Rel(worker, ext1, "<verb>", "HTTPS / REST")
    Rel(api, ext2, "<verb>", "HTTPS / REST")
```

---

## Level 3 — Component (zoom into one container)

```mermaid
C4Component
    title Component Diagram — <Container Name>

    Container(web, "Web SPA", "React")
    ContainerDb(db, "<Primary store>", "PostgreSQL")
    ContainerQueue(bus, "Event Bus", "<broker>")
    System_Ext(ext, "<External>", "<role>")

    Container_Boundary(c, "<Container Name>") {
        Component(http, "HTTP Edge", "<framework>", "Validates inputs, maps to use cases")
        Component(uc, "<Use Cases>", "<language>", "Business logic for <domain>")
        Component(repo, "<Repository>", "<language + ORM/query lib>", "Persistence for <aggregate>")
        Component(adapter, "<External Adapter>", "<language>", "Wraps the external system's SDK")
        Component(pub, "Event Publisher", "<language>", "Publishes domain events")
    }

    Rel(web, http, "Calls", "HTTPS / JSON")
    Rel(http, uc, "Invokes")
    Rel(uc, repo, "Reads/writes <aggregate>")
    Rel(repo, db, "Queries", "SQL")
    Rel(uc, adapter, "Calls")
    Rel(adapter, ext, "Calls", "HTTPS / REST")
    Rel(uc, pub, "Publishes events")
    Rel(pub, bus, "Sends events", "<protocol>")
```

---

## Dynamic — Scenario / Sequence Across Containers

```mermaid
C4Dynamic
    title Dynamic — <Scenario Name (happy path)>

    Person(user, "<User Role>")
    Container(web, "Web SPA", "React")
    Container(api, "<API>", "<language>")
    Component(uc, "<Use Cases>", "<language>")
    Component(repo, "<Repository>", "<language>")
    ContainerDb(db, "<Store>", "PostgreSQL")
    ContainerQueue(bus, "Event Bus", "<broker>")
    System_Ext(ext, "<External>", "<role>")

    Rel(user, web, "1. <Initiates action>")
    Rel(web, api, "2. POST /<resource>", "HTTPS / JSON")
    Rel(api, uc, "3. <UseCase>(...)")
    Rel(uc, ext, "4. <call>", "HTTPS / REST")
    Rel(uc, repo, "5. Save(<aggregate>)")
    Rel(repo, db, "6. INSERT", "SQL")
    Rel(uc, bus, "7. Publish <event>", "<protocol>")
    Rel(api, web, "8. 201 Created")
```

**Sequence-diagram alternative** — same flow, more compact, renders reliably everywhere:

```mermaid
sequenceDiagram
    autonumber
    participant U as <User>
    participant W as Web SPA
    participant A as <API>
    participant DB as <Store>
    participant Q as Event Bus
    participant E as <External>

    U->>W: <Initiates action>
    W->>A: POST /<resource>
    A->>E: <call>
    E-->>A: <response>
    A->>DB: INSERT <aggregate>
    A->>Q: Publish <event>
    A-->>W: 201 Created
    W-->>U: Confirmation
```

---

## Deployment

```mermaid
C4Deployment
    title Deployment — <System> (<region/topology>)

    Deployment_Node(clientdev, "<Client Device>", "Browser / iOS / Android") {
        Container(client, "Web SPA / Mobile App", "<tech>")
    }

    Deployment_Node(cdn, "CDN", "<provider>") {
        Container(assets, "Static assets", "JS / CSS / images")
    }

    Deployment_Node(region, "<Cloud Region>") {
        Deployment_Node(azA, "Availability Zone A") {
            Deployment_Node(computeA, "<Compute>", "<k8s / ECS / Cloud Run>") {
                Container(apiA, "<API> replica", "<tech>")
                Container(workerA, "<Worker> replica", "<tech>")
            }
            Deployment_Node(dbnodeA, "<DB primary>", "<tech>") {
                ContainerDb(dbA, "<Store (rw)>", "<tech>")
            }
        }
        Deployment_Node(azB, "Availability Zone B") {
            Deployment_Node(computeB, "<Compute>", "<k8s / ECS / Cloud Run>") {
                Container(apiB, "<API> replica", "<tech>")
                Container(workerB, "<Worker> replica", "<tech>")
            }
            Deployment_Node(dbnodeB, "<DB standby>", "<tech>") {
                ContainerDb(dbB, "<Store (ro)>", "<tech>")
            }
        }
        Deployment_Node(brokernode, "<Managed broker>", "<tech>") {
            ContainerQueue(bus, "<event topic>", "<broker>")
        }
    }

    Rel(client, cdn, "Loads assets", "HTTPS")
    Rel(client, apiA, "API calls", "HTTPS")
    Rel(client, apiB, "API calls", "HTTPS")
    Rel(apiA, dbA, "Reads/writes", "TCP/5432")
    Rel(apiB, dbA, "Reads/writes", "TCP/5432")
    Rel(dbA, dbB, "Streaming replication", "TCP/5432")
    Rel(apiA, bus, "Publishes", "<protocol>")
    Rel(workerA, bus, "Consumes", "<protocol>")
```

---

## Flowchart Fallbacks (when C4 renderer fails)

Same diagrams, expressed as mermaid `flowchart` with C4 conventions imposed via styling. Renders reliably anywhere mermaid renders.

### Fallback — Context (L1)

```mermaid
flowchart LR
    user((<User Role>))
    admin((<Admin Role>))

    sys[<System Name><br/>Purpose: ...]

    ext1[<External System 1><br/>(external)]
    ext2[<External System 2><br/>(external)]

    user -->|<verb>, HTTPS| sys
    admin -->|<verb>, HTTPS| sys
    sys -->|<verb>, HTTPS/REST| ext1
    sys -->|<verb>, HTTPS/Webhook| ext2

    classDef person fill:#08427b,color:#fff,stroke:#052e56;
    classDef system fill:#1168bd,color:#fff,stroke:#0b4884;
    classDef external fill:#999,color:#fff,stroke:#666;
    class user,admin person
    class sys system
    class ext1,ext2 external
```

### Fallback — Container (L2)

```mermaid
flowchart LR
    user((<User Role>))

    subgraph sys[<System Name>]
        web["Web SPA<br/>[React]"]
        mobile["Mobile App<br/>[Swift / Kotlin]"]
        api["<API name><br/>[<language>]"]
        worker["<Worker name><br/>[<language>]"]
        bus[("Event Bus<br/>[<broker>]")]
        db[("Primary Store<br/>[PostgreSQL]")]
        cache[("Read Cache<br/>[Redis]")]
    end

    ext1["<External System><br/>(external)"]
    ext2["<External Notifier><br/>(external)"]

    user -->|HTTPS| web
    user -->|HTTPS| mobile
    web -->|HTTPS/JSON| api
    mobile -->|HTTPS/JSON| api
    api -->|SQL/TCP| db
    api -->|RESP| cache
    api -->|publishes events| bus
    bus -->|consumed by| worker
    worker -->|HTTPS/REST| ext1
    api -->|HTTPS/REST| ext2

    classDef person fill:#08427b,color:#fff,stroke:#052e56;
    classDef container fill:#1168bd,color:#fff,stroke:#0b4884;
    classDef store fill:#438dd5,color:#fff,stroke:#2e6295;
    classDef external fill:#999,color:#fff,stroke:#666;
    class user person
    class web,mobile,api,worker container
    class bus,db,cache store
    class ext1,ext2 external
```

### Fallback — Component (L3)

```mermaid
flowchart LR
    web["Web SPA<br/>[React]"]
    db[("Primary Store<br/>[PostgreSQL]")]
    bus[("Event Bus<br/>[broker]")]
    ext["<External><br/>(external)"]

    subgraph container[<Container Name>]
        http["HTTP Edge<br/>[<framework>]"]
        uc["<Use Cases><br/>[<language>]"]
        repo["<Repository><br/>[<language>]"]
        adapter["<External Adapter><br/>[<language>]"]
        pub["Event Publisher<br/>[<language>]"]
    end

    web -->|HTTPS/JSON| http
    http -->|invokes| uc
    uc -->|reads/writes| repo
    repo -->|SQL| db
    uc -->|calls| adapter
    adapter -->|HTTPS/REST| ext
    uc -->|publishes| pub
    pub -->|protocol| bus

    classDef component fill:#85bbf0,color:#000,stroke:#5d82a8;
    classDef container_outer fill:#1168bd,color:#fff,stroke:#0b4884;
    classDef store fill:#438dd5,color:#fff,stroke:#2e6295;
    classDef external fill:#999,color:#fff,stroke:#666;
    class http,uc,repo,adapter,pub component
    class web container_outer
    class db,bus store
    class ext external
```

### Fallback — Deployment

```mermaid
flowchart TB
    subgraph clientdev[<Client Device>]
        client["Web SPA / Mobile App"]
    end

    subgraph cdn[CDN]
        assets["Static assets"]
    end

    subgraph region[<Cloud Region>]
        subgraph azA[Availability Zone A]
            subgraph computeA[<Compute>]
                apiA["<API> replica"]
                workerA["<Worker> replica"]
            end
            dbA[("Store (rw)<br/>[PostgreSQL]")]
        end
        subgraph azB[Availability Zone B]
            subgraph computeB[<Compute>]
                apiB["<API> replica"]
                workerB["<Worker> replica"]
            end
            dbB[("Store (ro)<br/>[PostgreSQL]")]
        end
        bus[("<event topic><br/>[broker]")]
    end

    client -->|HTTPS| assets
    client -->|HTTPS| apiA
    client -->|HTTPS| apiB
    apiA -->|TCP/5432| dbA
    apiB -->|TCP/5432| dbA
    dbA -->|streaming replication| dbB
    apiA -->|publishes| bus
    workerA -->|consumes| bus

    classDef container fill:#1168bd,color:#fff,stroke:#0b4884;
    classDef store fill:#438dd5,color:#fff,stroke:#2e6295;
    class client,assets,apiA,workerA,apiB,workerB container
    class dbA,dbB,bus store
```

---

## Quick reference — which skeleton when

| You are producing... | Use |
|---|---|
| The first slide of a system design | Level 1 — System Context |
| A solution-architecture view across multiple systems | Level 1 — System Landscape |
| The "shape of the system" picture for a design doc, ADR, or review | Level 2 — Container |
| The internal structure of a non-trivial, load-bearing container | Level 3 — Component |
| The flow for one architecturally-significant scenario (per QAS) | Dynamic (or sequence-diagram alternative) |
| The "where it runs" view for ops, availability, region, or cost discussions | Deployment |
| Any of the above but your environment can't render mermaid C4 | The matching Fallback |

For every diagram type: title, labels on every arrow, technology on inter-system arrows at L2+, explicit boundaries, and one direction of meaning per arrow.
