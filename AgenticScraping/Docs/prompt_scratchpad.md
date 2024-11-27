Here's an example of how to extract and format quotes from an article:
    ###EXAMPLE ARTICLE TEXT###
    José Mourinho sarcastically described Clément Turpin as "one of the best referees in the world" after the Fenerbahce manager was sent off in his side's 1-1 draw with former club Manchester United.
    Mourinho was shown a red card after protesting when he thought his side should have had a ­penalty ­during the second half after Youssef ­En-Nesyri had cancelled out ­Christian Eriksen's opening goal. He watched the rest of the match from the stands but revealed afterwards that he had been to see Turpin to ask about his dismissal.
    "The referee told me something incredible," said Mourinho. "He said at the same time he could see the action in the box and my behaviour on the touchline.
    "I congratulate him because he is absolutely incredible. During the game, 100 miles per hour, he had one eye on the penalty situation and one eye on my behaviour on the bench. That's the explanation he gave me and that is why he is one of the best referees in the world."
    He added: "I think the best thing I have to do when I leave Fenerbahce I go to a club that doesn't play in Uefa competitions. So if any club in ­England at the bottom of the table needs a manager in the next two years, I'm ready to go. I don't want to say anything else – we played ­absolutely fantastic against a team that is far more superior."
    United have now gone exactly a year since their last victory in Europe having picked up three straight draws to start their Europa League campaign.
    Erik ten Hag was pleased with his side's performance but admitted that he was disappointed not to have claimed all three points.
    "Of course when you are ­taking the lead, it [drawing] shouldn't ­happen," the Dutchman said. "We had chances to make a second goal. Disappointed not to win. At Old ­Trafford we have to win games."
    Asked whether he would like to face Fenerbahce again in the final, he added: "It would be a very good final. We should keep the ball ­better in the first half. We should score more goals but to be honest they also ­created good chances. They gave us some problems. They are a good team with a good manager. It is not a bad point. But we want to win. We want to win every game."
    
    ###EXPECTED OUTPUT###
    [
        {
            "speaker": "José Mourinho",
            "quote_raw": "The referee told me something incredible. He said at the same time he could see the action in the box and my behaviour on the touchline. I congratulate him because he is absolutely incredible. During the game, 100 miles per hour, he had one eye on the penalty situation and one eye on my behaviour on the bench. That's the explanation he gave me and that is why he is one of the best referees in the world.",
            "quote_summary": "The referee claimed he could watch both the match and my behavior simultaneously, praising him for his skills.",
            "article_date": "2024-10-24"
        },
        {
            "speaker": "José Mourinho",
            "quote_raw": "I think the best thing I have to do when I leave Fenerbahce I go to a club that doesn't play in Uefa competitions. So if any club in ­England at the bottom of the table needs a manager in the next two years, I'm ready to go. I don't want to say anything else – we played ­absolutely fantastic against a team that is far more superior.",
            "quote_summary": "My plan after leaving Fenerbahce is to join a club not in Uefa competitions. I'd be available for any struggling club in England. Despite facing a superior team, we played extremely well.",
            "article_date": "2024-10-24"
        },
        "speaker": "Erik ten Hag",
        "quote_raw": "Of course when you are ­taking the lead, it [drawing] shouldn't ­happen. We had chances to make a second goal. Disappointed not to win. At Old ­Trafford we have to win games.",
        "quote_summary": "We shouldn't draw when leading. We missed opportunities to score a second goal and it's disappointing. At Old Trafford, we have an expectation to win.",
        "article_date": "2024-10-24"
    },
    {
        "speaker": "Erik ten Hag",
        "quote_raw": "It would be a very good final. We should keep the ball ­better in the first half. We should score more goals but to be honest they also ­created good chances. They gave us some problems. They are a good team with a good manager. It is not a bad point. But we want to win. We want to win every game.",
        "quote_summary": "A final against Fenerbahce would be interesting. Despite some errors on our side, they were challenging, they're a good team with a competent manager. It's not bad to draw, but our goal is always to win.",
        "article_date": "2024-10-24"