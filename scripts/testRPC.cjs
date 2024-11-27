const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const { resolve } = require('path');

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuoteSimilarity() {
    try {
        // Test parameters for the similarity search
        const params = {
            query_embedding: [0.022210505,0.018165337,-0.08975218,0.02194504,0.0096388785,0.034358654,-0.019808685,-0.03311982,0.01721725,-0.0016796931,0.017520638,0.020314332,0.008842486,0.025825875,-0.023879137,-0.012698038,-0.00037903705,0.026344161,-0.031527035,0.0045760972,0.014802789,0.065885685,0.014752225,0.017748179,0.017748179,0.028366746,0.042727094,0.012679076,0.013020387,-0.004509731,-0.007502524,-0.03468732,-0.038201563,-0.00712961,0.0013067791,0.018860599,-0.048112225,-0.059716806,-0.009531429,-0.020478668,-0.026773961,-0.053446792,0.009120592,-0.03299341,0.016521987,-0.0016986548,-0.03564805,0.013070952,-0.021629011,-0.013311134,-0.019656992,0.00079362735,0.047631864,0.117411025,0.03213381,0.0016623116,0.032336067,0.042878788,-0.028467875,-0.01810213,0.010062357,-0.03344849,-0.039086442,-0.017090838,-0.054407522,-0.008905692,0.01908814,0.0031223646,0.014752225,0.0055431454,0.036785755,0.035294097,-0.0064975526,0.009272286,-0.011200061,-0.054053567,0.022134658,0.008880409,0.037240837,0.02237484,0.030692719,0.013791498,-0.005404093,-0.012097583,-0.03006066,-0.009455582,-0.05835156,0.03226022,0.03496543,0.0007260762,-0.009563032,0.008052414,0.020819979,-0.018051567,0.033170383,-0.06750376,-0.030085944,0.025092687,0.021856552,0.028139206,0.023095386,-0.029150497,-0.034282807,-0.019732838,0.04912352,0.056784056,-0.0076162945,-0.00049063476,0.0023986588,-0.028619569,-0.029757272,-0.004892126,0.008747677,0.02093375,-0.004203183,-0.01777346,-0.035167687,-0.017571202,-0.010991482,-0.030667435,-0.018746829,-0.025358152,-0.046923958,0.032083247,-0.024144601,-0.0034952788,0.0007580741,-0.007926003,0.012242956,0.018544571,0.04181693,-0.014006397,-0.040982615,0.050943844,-0.022362199,0.02851844,-0.025724746,0.017672332,-0.024195166,-0.017621767,-0.011667783,0.015940493,0.0031776698,0.0030718,-0.013285851,-0.00077032024,-0.061891083,0.03499071,-0.017798742,0.008798243,4.3281132e-05,0.02073149,-0.06623964,0.02674868,0.00061072566,-0.007875438,0.06891956,-0.0035490035,0.012906617,-0.008134582,-0.030541025,-0.0217175,0.0133996215,0.017912513,0.0015414305,0.009386056,-0.0033183026,0.04037584,0.036684625,-0.056531236,-0.056430105,0.037670635,-0.04297992,-0.0055747484,0.0042379466,0.012400971,0.0122176735,-0.04649416,-0.045659844,0.032715302,-0.04191806,0.04727791,-0.007907041,-0.0012356726,0.004133657,-0.006437507,-0.039971326,0.0083178785,0.011427602,-0.0052998033,-0.013311134,-0.023171233,0.041842215,0.006080394,0.0059824255,-0.07240852,0.035243534,0.049957834,-0.055267118,0.034813736,0.045128915,0.0016686321,0.024182525,0.050058965,-0.04255012,-0.002894824,-0.01173731,0.030996107,0.047758274,-0.007926003,0.03554692,-0.01808949,0.006172043,0.024700813,-0.029479168,-0.01458789,-0.037872892,0.01305831,-0.034029983,-0.014398273,0.04563456,0.04517948,0.046317182,-0.06497552,-0.011598257,0.07711103,0.057188574,-0.041715804,-0.0070474427,-0.01624388,0.02576267,-0.020718848,-0.00060717034,-0.048314486,0.005517863,0.004430724,0.006412225,-0.037139706,0.0076858206,-0.015826723,0.024220448,-0.039288703,0.0070158397,-0.016180675,-0.017596485,0.0023607353,-0.0059855855,-0.020352256,-0.05976737,-0.027254324,-0.012299841,-0.02489043,-0.0033183026,-0.030743282,-0.10128091,0.0071359305,-0.02028905,-0.005309284,-0.020225843,0.010599607,0.009790572,0.011610898,-0.01930304,0.021768065,0.017356303,-0.020339614,-0.050640456,0.0010713377,0.013108876,0.02533287,0.010024434,-0.033600185,-0.014069603,0.022918409,0.001601476,-0.0028474196,0.025383435,0.003925078,0.016863298,-0.0025803752,0.0053819707,0.011724669,-0.0035490035,-0.00788808,-0.01676217,-0.008065055,0.0028126563,-0.017507996,0.02093375,0.034813736,-0.015725594,-0.01294454,-0.017533278,0.0405781,-0.0018140054,-0.025750028,0.005846533,-0.0017903033,0.033094537,-0.007919682,0.004102054,0.052384935,-0.015738236,-0.02337349,0.01348811,-0.04431988,0.015864646,0.005615832,-0.00932285,-0.02041546,0.00095045666,-0.015295794,-0.046241336,-0.027507149,-0.0008248352,0.0015959456,0.03542051,0.029226344,0.009032103,0.024283653,0.0047404324,-0.0013478629,-0.00625105,-0.0039566807,0.021414112,0.0038460707,0.05769422,0.065632865,0.019176628,0.024258371,-0.037797045,-0.0122176735,-0.0024065594,0.036912166,0.022438046,-0.023879137,-0.068869,0.011023085,-0.01590257,0.010656492,0.015712952,-0.017824026,-0.03653293,-0.02403083,-0.076302,-0.04497722,0.0038776735,-0.031173082,-0.042701814,-0.032740586,-0.018607777,0.04255012,0.01832967,-0.039440397,0.02973199,0.0036690945,-0.004895286,0.0052144756,-0.0062226076,0.0024207807,0.0022027208,0.038100433,0.015384283,0.011054688,0.031451188,0.0372914,-0.020339614,-0.056531236,0.05536825,-0.001359714,0.011320152,0.016610475,-0.00015821193,-0.008640228,0.03542051,0.00011791825,-0.002359155,-0.010435271,0.00406097,-0.01097252,-0.02687509,-0.0079702465,-0.0042253053,0.0036438121,-0.007907041,-0.009828496,0.00057201216,-0.0647227,-0.010877712,0.008128261,0.0491488,-0.02510533,-0.0100560365,-0.0052682003,0.013740933,-0.038125716,-0.0028347785,0.05008425,-0.02556041,0.041083746,0.018001001,0.04849146,-0.01942945,0.04406706,0.01205966,0.02226107,-0.011983813,0.014271861,-0.0348643,0.022336917,0.020453384,-0.023765367,0.05031179,-0.011389678,0.01832967,-0.024751376,0.008393725,0.014120167,-0.0025361313,0.068565615,-0.012805488,0.0048889657,0.026243033,-0.012856052,0.027936947,0.03630539,-0.0036596137,-0.022298994,0.03423224,-0.021932399,0.009525108,0.0104731945,0.020238485,0.0017903033,0.02730489,-0.01875947,-0.037443094,-0.008071376,0.022994256,0.011528731,-0.03496543,-0.016281804,-0.014878636,0.017040273,-0.0058970978,0.021439394,0.05021066,-0.019252475,-0.0031539677,0.0087350365,-0.06623964,-0.070790455,-0.021919759,0.045027785,-0.018114772,0.020086791,0.0471515,0.04330859,-0.01404432,0.03246248,0.05536825,-0.012375688,-0.028998803,-0.018001001,0.011421281,-0.020339614,0.021805989,-0.0011487647,-0.035167687,0.00031089335,-0.021414112,-0.004781516,0.0055083823,-0.019656992,-0.043510847,-0.013197363,0.02303218,-0.06927352,0.028113924,-0.04892126,0.008248352,0.037999306,0.047454886,0.0745828,0.00054238446,-0.08631379,-0.006172043,0.009398697,-0.050969128,0.0015927852,0.031350058,-0.0038808337,0.04002189,-0.01272332,0.023563107,0.034409218,-0.0111684585,0.018026283,0.015219947,-0.016648399,-0.007647897,0.06295294,-0.019720199,0.02983312,-0.019176628,0.051626466,-0.012679076,0.00036007533,-0.0048636836,-0.017533278,-0.006763017,-0.00745828,-0.021843912,-0.04222145,-0.040274713,-0.0037417812,-0.0057232818,0.015055613,0.020440744,-0.01150977,0.0125589855,0.005100705,-0.038327973,-0.008779281,0.023424055,0.0073255477,0.026167186,0.06841392,-0.027911665,-0.013943192,0.03840382,-0.03347377,-0.016496705,-0.01734366,0.01293822,0.023740085,0.029403321,-0.0019435772,0.039440397,0.014132809,0.017634409,-0.0012546343,-0.015042972,-0.027254324,-0.023322927,-0.00998019,0.025712105,0.0012546343,0.018797394,-0.0021015916,-0.0036627739,-0.0022532854,0.05946398,-0.0032550967,0.015321077,-0.025370793,0.00898786,-0.006548117,0.009619917,0.02293105,0.0022422245,-0.0016939144,0.01162986,0.014575249,-0.059514545,0.015662389,-0.009057386,0.008374764,0.054104134,-0.0024334218,0.047808837,0.035369944,-0.04080564,-0.048895977,0.03473789,0.013993756,0.024169883,0.0037481016,0.013791498,0.008697113,0.014840713,0.016496705,-0.0044370447,-0.0037164988,-0.026141904,-0.041488264,0.024447989,-0.006845184,-0.006680849,-0.01918927,-0.014309784,-0.014398273,0.040982615,0.0425754,0.030212354,0.019126063,-0.0072876243,-0.016269164,-0.001600686,0.02753243,0.009600955,0.0016164874,-0.038454387,0.0057232818,-0.01337434,0.015472771,-0.03370131,-0.009600955,0.032209657,-0.017684972,-0.0065860404,-0.04156411,-0.02490307,-0.022539174,-0.010700735,-0.02183127,0.0018124252,0.011971171,0.015308436,0.007578371,0.0026135582,0.04396593,0.0009164836,-0.01798836,-0.042651247,0.04464855,-0.0016923343,0.030541025,0.017078197,0.00811562,-0.028063359,0.023108026,0.037114423,-0.032614175,-0.005318765,0.04859259,-0.048036378,-0.016648399,-0.00877296,0.00482576,-0.009866419,-0.029327475,-0.002292789,-0.030515742,-0.018569853,-0.05713801,0.0044465256,0.0020162638,0.027254324,-0.03347377,0.003849231,-0.0036722547,0.032917563,0.018987011,-0.016939145,0.01229352,0.010921956,0.0019688595,-0.021452036,0.008374764,-0.004971133,-0.042373143,-0.0049584922,-0.01678745,0.03266474,0.039693218,0.040274713,-0.010485836,-0.009607276,0.014891278,-0.008709754,-0.03992076,0.0068388637,-0.012849731,0.054660343,0.011326472,0.030212354,0.02917578,0.02697622,0.009581993,0.026344161,-0.038707208,0.030465178,-0.005615832,-0.002401819,0.034813736,0.036103133,-0.029125215,0.026900373,0.019732838,0.01611747,0.054053567,-0.022577098,-0.015106177,0.029352756,-0.036886882,-0.030212354,0.0065165143,0.02664755,-0.0015224688,-0.0060519516,0.025623616,-0.0018329672,0.018784752,0.003574286,-0.017154044,-0.004484449,-0.018051567,-0.005363009,0.01700235,-0.020870542,-0.01611747,0.010586965,-0.012040698,0.030085944,-0.0041052145,-0.0050912243,-0.025712105,0.008128261,-0.012426253,-0.024650248,0.04401649,0.013121516,-0.0066429256,0.0060266694,-0.019897174,0.00647227,0.02730489,-0.025054764,0.038833622,0.016408216,0.008627587,0.03266474,0.038024586,0.006965275,0.0023749566,-0.037266117,0.0025408717,-0.03150175,-0.052486066,0.012261918,-0.040047172,0.0018361274,-0.019682275,0.0012901876,0.018595135,0.010011793,0.0019941418,-0.022678228,0.01601634,0.018354954,0.010599607,-0.0004234786,0.035369944,-0.02238748,0.008229391,-0.03979435,-0.020453384,-0.0036659343,-0.020946389,0.018708905,-0.039313983,0.007926003,0.026900373,-0.0067503755,0.008204108,0.005615832,-0.004354877,0.028670134,-0.005878136,-0.003912437,-0.026521139,-0.0047846762,-0.029453885,0.020200562,-0.014069603,-0.020668285,-0.0012570046,0.008810883,-0.008235711,0.03375188,0.00657972,-0.012122865,-0.037721198,0.0025250702,0.017899873,0.0038776735,-0.020756772,-0.0008872509,0.0006296874,-0.0017602805,-0.04285351,0.005628473,0.009923304,-0.00877296,-0.014865995,-0.026824526,-0.049730293,0.004961652,0.03509184,-0.014701661,-0.035799745,0.0001129803,-0.022071453,0.0055083823,-0.032159094,0.008267314,0.006010868,0.012571626,-0.019151347,0.009474544,0.012198712,-7.7525816e-05,-0.010568003,0.038555514,0.012912937,-0.020516591,-0.007161213,-0.0007580741,-0.04356141,0.005404093,0.02324708,0.02337349,-0.032715302,0.010921956,0.0039724824,-0.017368944,0.029656144,0.0099865105,0.017558562,-0.04922465,-0.005603191,-0.008058735,-0.032715302,0.024258371,-0.0060045472,-0.02654642,-0.0030575788,-0.00811562,-0.0064533083,-0.038757775,-0.0026024973,0.014891278,0.013361698,0.015510694,0.009392376,0.0003357806,-0.009006822,0.017937796,-0.045609277,-0.007875438,-0.009942266,0.078375146,0.009158515,-0.0067946194,0.035622768,0.01414545,0.0021221335,-0.038479667,-0.01676217,-0.0013707749,0.038580798,-0.014158091,-0.03311982,0.0076415767,0.003334104,0.010112922,-0.012167109,0.007723744,-0.0070664044,-0.041614674,-0.005100705,-0.016838016,0.0033530658,-0.034257524,0.0026388406,0.0122872,-0.020377537,-0.014436197,-0.00046772265,-0.018696265,-0.010100281,0.011206382,0.03301869,-0.016635757,-0.045482866,0.0042411066,-0.0062162867,-0.041842215,0.04199391,0.014941842,-0.0410079,0.014739584,-0.04232258,-0.037974022,0.011250625,0.0066618873,0.021363547,-0.019606428,0.007439318,0.023841213,0.048845414,0.013386981,-0.025206458,0.023980265,0.016863298,-0.024081396,-0.010321501,0.0056316336,-0.02993425,0.0025945965,0.02424573,0.040198866,0.041083746,-0.0044465256,-0.008577022,0.033928853,0.015333718,0.0071359305,0.01436035,-0.02336085,-0.008924654,0.009461903,-0.045836817,0.021009596,0.049072955,-0.03890947,-0.009487185,-0.000690918,8.453771e-05,0.027052067,-0.010372066,0.021300342,-0.01786195,0.016863298,0.0014118587,0.04310633,0.003409951,-0.002763672,0.03049046,0.003719659,-0.08419008,0.034282807,0.040274713,-0.01832967,-0.008627587,0.0051259873,0.025067406,-0.042727094,-0.003631171,0.032083247,0.026344161,0.030591588,-0.010707056,0.024321577,-0.011465525,-0.016585192,-0.03719027,0.047682427,-0.014853355,0.0018171656,-0.04093205,0.0005573958,0.01942945,-0.030439895,0.005344047,0.0054925806,-0.00055028516,0.003049678,0.034055267,-0.062649556,-0.036052566,-0.012167109,-0.0095693525,-0.020756772,0.018430801,-0.01951794,0.01875947,-4.3725548e-05,0.0008864608,0.019783404,0.023676878,-0.04869372,0.00888673,-0.044597987,-0.020137357,0.008766639,-0.038353257,-0.0011124214,-0.011895324,0.02127506,-0.042398427,0.0045002503,0.027835818,-0.009550391,-0.009392376,0.049426906,-0.07483562,0.038151,0.01942945,-0.005824411,-0.021970322,0.042196166,-0.02588908,-0.017558562,-0.017811384,0.02073149,0.038681928,-0.03683632,0.005890777,-0.012205033,-0.000888041,0.01173731,0.019682275,-0.016357651,0.035572205,-0.02687509,-0.03253833,-0.033499055,0.0011321732,0.02226107,0.009695764,0.031248929,-0.06012132,0.047783557,-0.010131883,-0.02458704,-0.0028268776,0.04924993,0.0023528344,0.004133657,-0.0059287003,0.016155394,-0.004177901,-0.021704858,0.01546013,-0.019252475,0.003190311,-0.028417312,-0.054862604,-0.040856205,-0.053901874,0.01951794,-0.007711103,0.012868693,0.0252191,-0.024612324,0.00039641865,0.0012878174,0.029251628,0.015308436,0.01887324,0.003574286,-0.009386056,0.0064849113,-0.004560296,0.02095903,-0.0006636605,0.025408717,0.016395574,0.006055112,0.00036817355,0.0018582494,0.010928276,0.007515165,0.019391527,0.0025282304,-0.0043706787,-0.03630539,0.04113431,0.0026483214,0.009373414,0.003280379,0.00790072,-0.0405781,-0.027557712,-0.028215053,0.019935098,0.002346514,-0.0101255635,0.0042821905,-0.0008264154,0.017672332,-0.040224146,-0.024195166,-0.021843912,0.0040388484,-0.00011801701,-0.00027553763,-0.014840713,-0.0024982078,0.011907966,-0.046595287,-0.019985663,-0.01129487,0.0054672984,0.021123366,-0.0018108451,-0.0030781205,0.03620426,-0.014815431,0.012590588,0.024384784,-0.016585192,0.02116129,0.03860608,0.007957606,-0.008602304,0.010447913,-0.03607785,0.014979766,-0.012318803,-0.030515742,-0.023550468,-0.009348133,-0.00031523875,0.025092687,0.00526504,0.030085944,0.044218753,-0.0047909967,0.02258974,-0.007723744,-0.013361698,0.019378887,-0.045710407,-0.0007952075,-0.061436,-0.011813157,0.029453885,0.020857902,-0.0010002312,-0.01733102,0.02237484,-0.011067329,0.01853193,0.017571202,-0.009512467,-0.016471421,0.0032645776,0.043156896,-0.009676802,0.007489883,0.0058338917,-0.009992831,-0.025547769,0.0074835625,0.060475275,-0.025724746,0.031173082,-0.0063901027,0.02160373,0.0064311866,-0.019126063,-0.014600531,0.005957143,0.03476317,-0.0033214628,0.013121516,-0.036886882,0.010397348,0.011263267,0.002905885,0.015409565,0.0015295794,0.018746829,-0.004301152,-0.013070952,0.004013566,-0.0074329977,-0.0033878288,-0.0302882,0.01710348,0.020276409,0.04869372,-0.029529732,0.008949936,0.05845269,0.01524523,-0.0023765366,0.029024087,0.012413612,0.0031634485,0.02544664,0.0025503526,-0.030541025,-0.0028916637,0.0017318379,-0.042524837,-0.014979766,-0.022855204,0.00898786,-0.0053756502,-0.028644852,-0.031729292,-0.016977068,-0.00054870505,0.02917578,7.085958e-05,0.018494006,-0.00014784223,-0.030541025,0.008412687,-0.0106122475,-0.01798836,0.019833969,0.032057963,0.005878136,0.010555362,0.010631209,-0.014132809,-0.03167873,-0.01030886,0.012521062,0.023651596,-0.016496705,-0.004076772,0.0009844297,0.019985663,-0.019568505,0.01940417,-0.0046551046,-0.010738659,-0.0091521945,0.0073761125,0.011876362,-0.024157243,0.05779535,-0.009828496,0.011288549,0.00953775,0.007843835,0.010928276,-0.017710255,0.0045824177,-0.023980265,-0.026192468,-0.019846609,-0.006548117,-0.05112082,-0.03236135,0.027456583,0.008027132,0.017722895,0.04836505,-0.008956256,-0.063660845,0.020377537,0.010846109,-0.007723744,-0.022981616,-0.037114423,-0.016774809,0.012141827,-0.044168185,-0.0028363585,-0.01590257,-0.0018882721,0.0021079122,0.011364396,0.01963171,-0.025383435,-0.0154854115,0.043232743,0.004430724,-0.008090338,-0.011983813,0.009898023,0.01841816,-0.008469572,-0.029681426,0.012521062,0.006187844,0.017419508,0.0078122322,-0.004794157,0.028341465,-0.025813233,0.018822676,0.03246248,0.008627587,0.026925655,0.025206458,0.029150497,0.007591012,0.013096234,-0.00071501517,-0.008431649,0.0012870274,-0.0061277985,-0.013728292,-0.008482213,-0.007843835,0.021982964,0.037013296,-0.011800515,-0.037797045,0.019720199,0.016269164,0.0016591513,0.03276587,-0.009025783,0.018468725,-0.025750028,-0.018544571,0.01293822,0.0142339375,-0.0042063436,-0.005890777,-0.0039756424,0.0010610668,0.043510847,0.012634832,-0.00843797,-0.0009551971,-0.011130535,-0.02227371,-0.0011700967,-0.032816432,-0.032336067,-0.013210004,0.03377716,0.007591012,-0.005549466,-0.005758045,0.0101255635,-0.0014000076,-0.02917578,-0.016585192,-0.028240334,-0.035167687,-0.0062226076,-0.020036226,-0.011433923,0.005144949,0.0016180675,-0.01698971,-0.015118819,-0.008090338,-0.028012794,-0.000691313,-0.012862373,0.005770686,-0.027279608,-0.0056253127,-0.0054167337,-0.008362123,-0.033322077,-0.020630362,0.0061594015,0.0043074726,0.00898786,0.013083593,0.0058433725,-0.030616872,-0.011086291,-0.017293097,0.0057738465,-0.023120668,-0.0122872,-0.012584267,-0.009405018,0.020048868,0.008216749,0.039642654,0.026521139,0.050741587,0.013222646,0.016926503,-0.03630539,-0.05076687,0.00023939183,0.011705707,-0.017014991,0.0029264267,-0.013778856,0.0052492386,-0.008058735,-0.0014071183,-0.010650171,0.022766715,0.013715651,0.0019736,-0.06831279,0.012110224,-0.06436875,-0.02391706,-0.011136855,0.035243534,-0.011705707,-0.019138705,-0.037089143,0.0015588121,-0.044168185,0.008728716,0.03466204,0.004955332,0.005935021,-0.019909816,-0.023196515,0.016345011,0.03190627,0.011358076,-0.0156244645,-0.05033707,0.030364048,0.035344664,-0.010707056,0.0077932705,0.031425904,0.0064659496,-0.02983312,-0.011067329,-0.025800593,-0.010372066,0.029605579,-0.0010026015,-0.02380329,0.030616872,0.00078177627,0.0061341194,0.011895324,-0.004986935,0.009461903,0.056885187,0.006788299,-0.0032961806,-0.010909314,0.0500084,-0.035395227,0.006045631,0.012432573,-0.020048868,-0.0068262224,0.009095309,0.033145104,0.0067756576,0.0004286141,-0.0007363471,-0.013829421,-0.00081140397,-0.0016156973,0.005887617,-0.01228088,-0.022235787,-0.017811384,0.02808864,0.030718,0.015725594,0.03334736,-0.02391706,0.0010721277,0.0076036532,0.010138204,0.046342466,-0.011389678,0.033372644,0.021679576,-0.045432303,-0.015422206,0.01447412,-0.032386634,-0.009689444,0.033600185,0.016800093,0.032968126,0.008810883,0.006260531,0.011939568,-0.010138204,0.04209504,0.016269164,0.004136817,-0.03554692,-0.0074962033,0.02040282,-0.032336067,-0.0155739,-0.008235711,0.010624888,0.055570506,-0.0017286777,0.028417312,-0.01052376,-0.002215362,-0.00037745692,0.013639804,-0.033296797,-0.013690368,0.030591588,-0.000116436866,-0.0019040736,0.018746829,-0.050842717,-0.020857902,-0.00037943208,0.021995606,-0.04090677,-0.009329171,0.010397348,0.0065101935,-0.032310788,0.0018835317,0.012021736,-0.017609125,0.014992407,0.011244305,-0.0077427058,-0.040173583,0.00197202,0.0024097196,-0.010251975,-0.0037133386,0.038024586,0.017293097,0.022311633,-0.0023939183,0.004904767,-0.028644852,-0.0023070103,-0.0068704663,-0.00756573,-0.02324708,-0.019985663,-0.020149997,-0.018633058,-0.04222145,0.048086945,-0.002028905,-0.0015722434,-0.0076605384,0.041892778,-0.010163487,-0.0004685127,0.017748179,-0.024827223], // Example embedding vector
            match_threshold: -0.9,
            match_count: 1
        };

        // Call the RPC function
        const { data, error } = await supabase.rpc('find_most_similar_quote', params);

        if (error) {
            console.error('Error calling RPC function:', error);
            return;
        }

        console.log('RPC function result:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the test
testQuoteSimilarity();
